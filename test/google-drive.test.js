import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('Google Drive OAuth uses state and PKCE, encrypts tokens, refreshes, and transfers files', async (context) => {
  let expectedChallenge = '';
  let refreshCount = 0;
  let uploadedContent = '';
  const google = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://google.test');
    if (request.method === 'POST' && url.pathname === '/token') {
      const body = new URLSearchParams(await readRequest(request));
      if (body.get('grant_type') === 'authorization_code') {
        const actualChallenge = crypto.createHash('sha256').update(body.get('code_verifier')).digest('base64url');
        if (actualChallenge !== expectedChallenge) return sendJson(response, 400, { error: 'invalid_grant' });
        return sendJson(response, 200, { access_token: 'initial-google-token', refresh_token: 'secret-google-refresh-token', expires_in: 1 });
      }
      if (body.get('grant_type') === 'refresh_token' && body.get('refresh_token') === 'secret-google-refresh-token') {
        refreshCount += 1;
        return sendJson(response, 200, { access_token: 'refreshed-google-token', expires_in: 3600 });
      }
      return sendJson(response, 400, { error: 'invalid_grant' });
    }
    if (url.pathname === '/drive/v3/about') return sendJson(response, 200, { user: { emailAddress: 'drive-user@example.test' } });
    if (request.headers.authorization !== 'Bearer refreshed-google-token') return sendJson(response, 401, { error: { message: 'expired' } });
    if (request.method === 'GET' && url.pathname === '/drive/v3/files') {
      const query = url.searchParams.get('q') || '';
      if (query.includes("name = 'Docs'")) return sendJson(response, 200, { files: [{ id: 'folder-1', name: 'Docs', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-08-04T10:00:00.000Z' }] });
      if (query.includes("name = 'hello.txt'")) return sendJson(response, 200, { files: [{ id: 'file-1', name: 'hello.txt', mimeType: 'text/plain', size: '17', modifiedTime: '2026-08-04T10:00:00.000Z' }] });
      if (query.includes("'root' in parents")) return sendJson(response, 200, { files: [
        { id: 'folder-1', name: 'Docs', mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-08-04T10:00:00.000Z' },
        { id: 'file-1', name: 'hello.txt', mimeType: 'text/plain', size: '17', modifiedTime: '2026-08-04T10:00:00.000Z' },
      ] });
      return sendJson(response, 200, { files: [] });
    }
    if (request.method === 'GET' && url.pathname === '/drive/v3/files/file-1' && url.searchParams.get('alt') === 'media') {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      return response.end('hello from drive');
    }
    if (request.method === 'POST' && url.pathname === '/upload/drive/v3/files') {
      response.writeHead(200, { Location: `http://127.0.0.1:${google.address().port}/upload-session/1` });
      return response.end();
    }
    if (request.method === 'PUT' && url.pathname === '/upload-session/1') {
      uploadedContent = await readRequest(request);
      return sendJson(response, 200, { id: 'uploaded-1', name: 'upload.txt' });
    }
    if (request.method === 'POST' && url.pathname === '/drive/v3/files') return sendJson(response, 200, { id: 'folder-new' });
    if (request.method === 'DELETE' && url.pathname === '/drive/v3/files/file-1') {
      response.writeHead(204);
      return response.end();
    }
    response.writeHead(404);
    response.end();
  });
  await listen(google);
  context.after(() => new Promise((resolve) => google.close(resolve)));

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'savelycloud-google-test-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const appPort = await availablePort();
  const googleBase = `http://127.0.0.1:${google.address().port}`;
  const callbackUrl = `http://127.0.0.1:${appPort}/api/connections/google/callback`;
  const app = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      PORT: String(appPort),
      DATA_PATH: path.join(tempRoot, 'data'),
      STORAGE_PATH: path.join(tempRoot, 'storage'),
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_REDIRECT_URI: callbackUrl,
      GOOGLE_AUTH_URL: `${googleBase}/auth`,
      GOOGLE_TOKEN_URL: `${googleBase}/token`,
      GOOGLE_DRIVE_API_URL: `${googleBase}/drive/v3`,
      GOOGLE_DRIVE_UPLOAD_URL: `${googleBase}/upload/drive/v3`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => app.kill());
  await waitForHealth(appPort, app);
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Google Tester', email: 'google@example.test', password: 'testing-password' }),
  });
  const cookie = register.headers.get('set-cookie').split(';')[0];
  const authHeaders = { Cookie: cookie };

  const start = await fetch(`${baseUrl}/api/connections/google/start?name=My%20Drive`, { headers: authHeaders });
  assert.equal(start.status, 200);
  const authorizationUrl = new URL((await start.json()).authorizationUrl);
  assert.equal(authorizationUrl.origin, googleBase);
  assert.equal(authorizationUrl.searchParams.get('access_type'), 'offline');
  assert.equal(authorizationUrl.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive');
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
  expectedChallenge = authorizationUrl.searchParams.get('code_challenge');
  const state = authorizationUrl.searchParams.get('state');

  const callback = await fetch(`${callbackUrl}?code=test-code&state=${encodeURIComponent(state)}`, { redirect: 'manual' });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/?google=connected');
  const replay = await fetch(`${callbackUrl}?code=replayed&state=${encodeURIComponent(state)}`, { redirect: 'manual' });
  assert.equal(replay.headers.get('location'), '/?google=invalid-state', 'OAuth state must be one-time use');

  const connectionResponse = await fetch(`${baseUrl}/api/connections`, { headers: authHeaders });
  const connection = (await connectionResponse.json()).connections[0];
  assert.equal(connection.provider, 'google');
  assert.equal(connection.details.accountEmail, 'drive-user@example.test');
  const stored = await readFile(path.join(tempRoot, 'data', 'connections.json'), 'utf8');
  assert.equal(stored.includes('secret-google-refresh-token'), false, 'Google refresh token must be encrypted at rest');

  const rename = await fetch(`${baseUrl}/api/connections/${connection.id}`, {
    method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Team Drive' }),
  });
  assert.equal((await rename.json()).connection.name, 'Team Drive');
  const refreshInfo = await fetch(`${baseUrl}/api/connections/${connection.id}/google-info`, { method: 'POST', headers: authHeaders });
  assert.equal((await refreshInfo.json()).connection.details.accountEmail, 'drive-user@example.test');

  const reconnectStart = await fetch(`${baseUrl}/api/connections/google/start?name=Updated%20Drive&connectionId=${connection.id}`, { headers: authHeaders });
  const reconnectUrl = new URL((await reconnectStart.json()).authorizationUrl);
  expectedChallenge = reconnectUrl.searchParams.get('code_challenge');
  const reconnectState = reconnectUrl.searchParams.get('state');
  const reconnectCallback = await fetch(`${callbackUrl}?code=updated-code&state=${encodeURIComponent(reconnectState)}`, { redirect: 'manual' });
  assert.equal(reconnectCallback.headers.get('location'), '/?google=connected');
  const afterReconnect = (await (await fetch(`${baseUrl}/api/connections`, { headers: authHeaders })).json()).connections;
  assert.equal(afterReconnect.length, 1, 'reconnecting should update the existing connection, not duplicate it');
  assert.equal(afterReconnect[0].id, connection.id);
  assert.equal(afterReconnect[0].name, 'Updated Drive');

  const listing = await fetch(`${baseUrl}/api/connections/${connection.id}/files`, { headers: authHeaders });
  assert.deepEqual((await listing.json()).items.map((item) => item.name), ['Docs', 'hello.txt']);
  assert.ok(refreshCount >= 1, 'expired Google access token should refresh automatically');
  const download = await fetch(`${baseUrl}/api/connections/${connection.id}/download?path=hello.txt`, { headers: authHeaders });
  assert.equal(await download.text(), 'hello from drive');
  const upload = await fetch(`${baseUrl}/api/connections/${connection.id}/files?path=upload.txt`, {
    method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'text/plain' }, body: 'uploaded to drive',
  });
  assert.equal(upload.status, 201, await upload.text());
  assert.equal(uploadedContent, 'uploaded to drive');
  const folder = await fetch(`${baseUrl}/api/connections/${connection.id}/folders`, {
    method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'New folder' }),
  });
  assert.equal(folder.status, 201, await folder.text());
  const remove = await fetch(`${baseUrl}/api/connections/${connection.id}/files?path=hello.txt`, { method: 'DELETE', headers: authHeaders });
  assert.equal(remove.status, 204);
});

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  response.end(body);
}

async function readRequest(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

async function availablePort() {
  const server = http.createServer();
  await listen(server);
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth(port, child) {
  const deadline = Date.now() + 8_000;
  let errorOutput = '';
  child.stderr.on('data', (chunk) => { errorOutput += chunk; });
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited during startup: ${errorOutput}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`Server did not become ready: ${errorOutput}`);
}
