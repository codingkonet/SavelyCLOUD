import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('WebDAV connection is encrypted, account-scoped, and usable', async (context) => {
  const remoteFiles = new Map([['hello.txt', Buffer.from('hello from WebDAV')]]);
  const webDav = http.createServer(async (request, response) => {
    const fileName = decodeURIComponent(new URL(request.url, 'http://local').pathname.replace(/^\/dav\/?/, ''));
    if (request.method === 'PROPFIND') {
      const items = [...remoteFiles.entries()].map(([name, content]) => `
        <d:response><d:href>/dav/${name}</d:href><d:propstat><d:prop>
          <d:displayname>${name}</d:displayname><d:resourcetype/><d:getcontentlength>${content.length}</d:getcontentlength>
          <d:getlastmodified>Tue, 04 Aug 2026 10:00:00 GMT</d:getlastmodified>
        </d:prop></d:propstat></d:response>`).join('');
      response.writeHead(207, { 'Content-Type': 'application/xml' });
      return response.end(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/</d:href><d:propstat><d:prop><d:displayname>dav</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>${items}</d:multistatus>`);
    }
    if (request.method === 'PUT') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      remoteFiles.set(fileName, Buffer.concat(chunks));
      response.writeHead(201);
      return response.end();
    }
    if (request.method === 'GET' && remoteFiles.has(fileName)) {
      const content = remoteFiles.get(fileName);
      response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': content.length });
      return response.end(content);
    }
    if (request.method === 'DELETE') {
      remoteFiles.delete(fileName);
      response.writeHead(204);
      return response.end();
    }
    if (request.method === 'MKCOL') {
      response.writeHead(201);
      return response.end();
    }
    response.writeHead(404);
    response.end();
  });
  await listen(webDav);
  context.after(() => new Promise((resolve) => webDav.close(resolve)));

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'savelycloud-test-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const appPort = await availablePort();
  const app = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      PORT: String(appPort),
      DATA_PATH: path.join(tempRoot, 'data'),
      STORAGE_PATH: path.join(tempRoot, 'storage'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => app.kill());
  await waitForHealth(appPort, app);

  const baseUrl = `http://127.0.0.1:${appPort}`;
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Connection Tester', email: 'connections@example.test', password: 'testing-password' }),
  });
  assert.equal(register.status, 201);
  const cookie = register.headers.get('set-cookie').split(';')[0];
  const authHeaders = { Cookie: cookie };

  const create = await fetch(`${baseUrl}/api/connections`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test WebDAV',
      provider: 'webdav',
      baseUrl: `http://127.0.0.1:${webDav.address().port}/dav/`,
      username: 'test-user',
      password: 'top-secret-value',
    }),
  });
  const createBody = await create.text();
  assert.equal(create.status, 201, createBody);
  const connection = JSON.parse(createBody).connection;
  const stored = await readFile(path.join(tempRoot, 'data', 'connections.json'), 'utf8');
  assert.equal(stored.includes('top-secret-value'), false, 'provider password must not be stored as plaintext');

  const listing = await fetch(`${baseUrl}/api/connections/${connection.id}/files`, { headers: authHeaders });
  assert.equal(listing.status, 200);
  assert.deepEqual((await listing.json()).items.map((item) => item.name), ['hello.txt']);

  const upload = await fetch(`${baseUrl}/api/connections/${connection.id}/files?path=second.txt`, {
    method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'text/plain' }, body: 'second remote file',
  });
  assert.equal(upload.status, 201, await upload.text());
  assert.equal(remoteFiles.get('second.txt').toString(), 'second remote file');

  const download = await fetch(`${baseUrl}/api/connections/${connection.id}/download?path=hello.txt`, { headers: authHeaders });
  assert.equal(await download.text(), 'hello from WebDAV');

  const anonymous = await fetch(`${baseUrl}/api/connections`);
  assert.equal(anonymous.status, 401);
  const unlink = await fetch(`${baseUrl}/api/connections/${connection.id}`, { method: 'DELETE', headers: authHeaders });
  assert.equal(unlink.status, 204);
  assert.equal(remoteFiles.has('hello.txt'), true, 'unlinking must not delete remote files');
});

test('S3-compatible connection signs requests and transfers files', async (context) => {
  const objects = new Map([['archive/original.txt', Buffer.from('from object storage')]]);
  let signedRequests = 0;
  const s3 = http.createServer(async (request, response) => {
    if (request.headers.authorization?.startsWith('AWS4-HMAC-SHA256 ')) signedRequests += 1;
    else { response.writeHead(403); return response.end('<Error><Message>Unsigned request</Message></Error>'); }
    const url = new URL(request.url, 'http://local');
    const key = decodeURIComponent(url.pathname.replace(/^\/test-bucket\/?/, ''));
    if (request.method === 'GET' && url.searchParams.get('list-type') === '2') {
      const prefix = url.searchParams.get('prefix') || '';
      const contents = [...objects.entries()].filter(([name]) => name.startsWith(prefix)).map(([name, content]) =>
        `<Contents><Key>${name}</Key><LastModified>2026-08-04T10:00:00.000Z</LastModified><Size>${content.length}</Size></Contents>`).join('');
      response.writeHead(200, { 'Content-Type': 'application/xml' });
      return response.end(`<ListBucketResult>${contents}</ListBucketResult>`);
    }
    if (request.method === 'PUT') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      objects.set(key, Buffer.concat(chunks));
      response.writeHead(200);
      return response.end();
    }
    if (request.method === 'GET' && objects.has(key)) {
      const content = objects.get(key);
      response.writeHead(200, { 'Content-Length': content.length });
      return response.end(content);
    }
    response.writeHead(404);
    response.end('<Error><Message>Not found</Message></Error>');
  });
  await listen(s3);
  context.after(() => new Promise((resolve) => s3.close(resolve)));

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'savelycloud-s3-test-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const appPort = await availablePort();
  const app = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve('.'),
    env: { ...process.env, PORT: String(appPort), DATA_PATH: path.join(tempRoot, 'data'), STORAGE_PATH: path.join(tempRoot, 'storage') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => app.kill());
  await waitForHealth(appPort, app);
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'S3 Tester', email: 's3@example.test', password: 'testing-password' }),
  });
  const cookie = register.headers.get('set-cookie').split(';')[0];
  const authHeaders = { Cookie: cookie };
  const create = await fetch(`${baseUrl}/api/connections`, {
    method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test S3', provider: 's3', endpoint: `http://127.0.0.1:${s3.address().port}`,
      region: 'us-east-1', bucket: 'test-bucket', prefix: 'archive', accessKeyId: 'test-key', secretAccessKey: 's3-super-secret',
    }),
  });
  const createBody = await create.text();
  assert.equal(create.status, 201, createBody);
  const connection = JSON.parse(createBody).connection;
  const stored = await readFile(path.join(tempRoot, 'data', 'connections.json'), 'utf8');
  assert.equal(stored.includes('s3-super-secret'), false);

  const listing = await fetch(`${baseUrl}/api/connections/${connection.id}/files`, { headers: authHeaders });
  assert.deepEqual((await listing.json()).items.map((item) => item.name), ['original.txt']);
  const upload = await fetch(`${baseUrl}/api/connections/${connection.id}/files?path=new.txt`, {
    method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'text/plain' }, body: 'new object',
  });
  assert.equal(upload.status, 201, await upload.text());
  assert.equal(objects.get('archive/new.txt').toString(), 'new object');
  const download = await fetch(`${baseUrl}/api/connections/${connection.id}/download?path=original.txt`, { headers: authHeaders });
  assert.equal(await download.text(), 'from object storage');
  assert.ok(signedRequests >= 4, 'all S3 provider requests should be signed');
});

test('Supabase Storage connection is encrypted, manageable, and usable', async (context) => {
  const objects = new Map([['cloud/welcome.txt', Buffer.from('hello from Supabase')]]);
  const storage = http.createServer(async (request, response) => {
    if (!request.headers.authorization?.startsWith('AWS4-HMAC-SHA256 ')) {
      response.writeHead(403);
      return response.end('<Error><Message>Unsigned request</Message></Error>');
    }
    const url = new URL(request.url, 'http://local');
    const key = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/s3\/documents\/?/, ''));
    if (request.method === 'GET' && url.searchParams.get('list-type') === '2') {
      const prefix = url.searchParams.get('prefix') || '';
      const contents = [...objects.entries()].filter(([name]) => name.startsWith(prefix)).map(([name, content]) =>
        `<Contents><Key>${name}</Key><LastModified>2026-08-05T10:00:00.000Z</LastModified><Size>${content.length}</Size></Contents>`).join('');
      response.writeHead(200, { 'Content-Type': 'application/xml' });
      return response.end(`<ListBucketResult>${contents}</ListBucketResult>`);
    }
    if (request.method === 'PUT') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      objects.set(key, Buffer.concat(chunks));
      response.writeHead(200);
      return response.end();
    }
    if (request.method === 'GET' && objects.has(key)) {
      const content = objects.get(key);
      response.writeHead(200, { 'Content-Length': content.length });
      return response.end(content);
    }
    if (request.method === 'DELETE') {
      objects.delete(key);
      response.writeHead(204);
      return response.end();
    }
    response.writeHead(404);
    response.end('<Error><Message>Not found</Message></Error>');
  });
  await listen(storage);
  context.after(() => new Promise((resolve) => storage.close(resolve)));

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'savelycloud-supabase-test-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const appPort = await availablePort();
  const app = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve('.'),
    env: { ...process.env, PORT: String(appPort), DATA_PATH: path.join(tempRoot, 'data'), STORAGE_PATH: path.join(tempRoot, 'storage') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => app.kill());
  await waitForHealth(appPort, app);
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Supabase Tester', email: 'supabase@example.test', password: 'testing-password' }),
  });
  const cookie = register.headers.get('set-cookie').split(';')[0];
  const headers = { Cookie: cookie };
  const create = await fetch(`${baseUrl}/api/connections`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Project files', provider: 'supabase', projectRef: 'abcdefghijklmnopqrst',
      endpoint: `http://127.0.0.1:${storage.address().port}/storage/v1/s3`, region: 'us-east-1',
      bucket: 'documents', prefix: 'cloud', accessKeyId: 'supabase-access', secretAccessKey: 'supabase-super-secret',
    }),
  });
  const createBody = await create.text();
  assert.equal(create.status, 201, createBody);
  const connection = JSON.parse(createBody).connection;
  assert.equal(connection.provider, 'supabase');
  assert.equal(connection.details.projectRef, 'abcdefghijklmnopqrst');
  const stored = await readFile(path.join(tempRoot, 'data', 'connections.json'), 'utf8');
  assert.equal(stored.includes('supabase-super-secret'), false, 'Supabase secret must not be stored as plaintext');

  const listing = await fetch(`${baseUrl}/api/connections/${connection.id}/files`, { headers });
  assert.deepEqual((await listing.json()).items.map((item) => item.name), ['welcome.txt']);
  const upload = await fetch(`${baseUrl}/api/connections/${connection.id}/files?path=added.txt`, {
    method: 'PUT', headers: { ...headers, 'Content-Type': 'text/plain' }, body: 'saved in Supabase',
  });
  assert.equal(upload.status, 201, await upload.text());
  assert.equal(objects.get('cloud/added.txt').toString(), 'saved in Supabase');
  const download = await fetch(`${baseUrl}/api/connections/${connection.id}/download?path=welcome.txt`, { headers });
  assert.equal(await download.text(), 'hello from Supabase');
  const update = await fetch(`${baseUrl}/api/connections/${connection.id}`, {
    method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Updated project files', projectRef: 'abcdefghijklmnopqrst', region: 'us-east-1', bucket: 'documents', prefix: 'cloud' }),
  });
  const updateBody = await update.text();
  assert.equal(update.status, 200, updateBody);
  assert.equal(JSON.parse(updateBody).connection.name, 'Updated project files');
  const remove = await fetch(`${baseUrl}/api/connections/${connection.id}/files?path=added.txt`, { method: 'DELETE', headers });
  assert.equal(remove.status, 204);
  assert.equal(objects.has('cloud/added.txt'), false);
});

test('admin can inspect usage, manage access, quotas, users, and files', async (context) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'savelycloud-admin-test-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const appPort = await availablePort();
  const app = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve('.'),
    env: { ...process.env, PORT: String(appPort), DATA_PATH: path.join(tempRoot, 'data'), STORAGE_PATH: path.join(tempRoot, 'storage') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => app.kill());
  await waitForHealth(appPort, app);
  const baseUrl = `http://127.0.0.1:${appPort}`;

  const adminRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Cloud Admin', email: 'admin@example.test', password: 'admin-password' }),
  });
  const adminCookie = adminRegistration.headers.get('set-cookie').split(';')[0];
  const adminUser = (await adminRegistration.json()).user;
  assert.equal(adminUser.role, 'admin', 'the first registered account should be the admin');

  const userRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Regular User', email: 'user@example.test', password: 'user-password' }),
  });
  const userCookie = userRegistration.headers.get('set-cookie').split(';')[0];
  const regularUser = (await userRegistration.json()).user;
  assert.equal(regularUser.role, 'user');
  const userUpload = await fetch(`${baseUrl}/api/files?path=notes.txt`, {
    method: 'PUT', headers: { Cookie: userCookie, 'Content-Type': 'text/plain' }, body: 'managed user content',
  });
  assert.equal(userUpload.status, 201);

  const denied = await fetch(`${baseUrl}/api/admin/users`, { headers: { Cookie: userCookie } });
  assert.equal(denied.status, 403, 'regular users must not reach admin APIs');
  const usersResponse = await fetch(`${baseUrl}/api/admin/users`, { headers: { Cookie: adminCookie } });
  const users = (await usersResponse.json()).users;
  const managed = users.find((user) => user.id === regularUser.id);
  assert.equal(managed.files, 1);
  assert.equal(managed.used, Buffer.byteLength('managed user content'));

  const update = await fetch(`${baseUrl}/api/admin/users/${regularUser.id}`, {
    method: 'PATCH', headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ storageLimit: 5 * 1024 * 1024, status: 'suspended' }),
  });
  assert.equal(update.status, 200, await update.text());
  const suspended = await fetch(`${baseUrl}/api/files`, { headers: { Cookie: userCookie } });
  assert.equal(suspended.status, 401, 'suspension should revoke existing sessions');
  const suspendedLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.test', password: 'user-password' }),
  });
  assert.equal(suspendedLogin.status, 403, 'suspended users must not receive new sessions');

  const managedFiles = await fetch(`${baseUrl}/api/admin/users/${regularUser.id}/files`, { headers: { Cookie: adminCookie } });
  assert.deepEqual((await managedFiles.json()).items.map((item) => item.name), ['notes.txt']);
  const managedDownload = await fetch(`${baseUrl}/api/admin/users/${regularUser.id}/download?path=notes.txt`, { headers: { Cookie: adminCookie } });
  assert.equal(await managedDownload.text(), 'managed user content');
  const managedDelete = await fetch(`${baseUrl}/api/admin/users/${regularUser.id}/files?path=notes.txt`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  assert.equal(managedDelete.status, 204);

  const selfDelete = await fetch(`${baseUrl}/api/admin/users/${adminUser.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  assert.equal(selfDelete.status, 400, 'an admin must not delete their own account');
  const userDelete = await fetch(`${baseUrl}/api/admin/users/${regularUser.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  assert.equal(userDelete.status, 204);
  const finalUsers = await fetch(`${baseUrl}/api/admin/users`, { headers: { Cookie: adminCookie } });
  assert.equal((await finalUsers.json()).users.length, 1);
});

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
