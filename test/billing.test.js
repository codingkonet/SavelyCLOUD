import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('billing plans can be edited from admin and purchased with PayPal', async (context) => {
  let tokenAuth = '';
  let orderBody = null;
  let captureCount = 0;
  const paypal = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://paypal.test');
    if (request.method === 'POST' && url.pathname === '/v1/oauth2/token') {
      tokenAuth = request.headers.authorization || '';
      return sendJson(response, 200, { access_token: 'paypal-access-token', expires_in: 3600 });
    }
    if (request.method === 'POST' && url.pathname === '/v2/checkout/orders') {
      orderBody = JSON.parse(await readRequest(request));
      assert.equal(orderBody.intent, 'CAPTURE');
      assert.equal(orderBody.purchase_units[0].reference_id, 'paid');
      assert.equal(orderBody.purchase_units[0].amount.value, '12.99');
      return sendJson(response, 201, {
        id: 'order-1',
        links: [{ rel: 'approve', href: 'http://paypal.test/approve/order-1' }],
      });
    }
    if (request.method === 'POST' && url.pathname === '/v2/checkout/orders/order-1/capture') {
      captureCount += 1;
      return sendJson(response, 201, { id: 'order-1', status: 'COMPLETED' });
    }
    response.writeHead(404);
    response.end();
  });
  await listen(paypal);
  context.after(() => new Promise((resolve) => paypal.close(resolve)));

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'savelycloud-billing-test-'));
  context.after(() => rm(tempRoot, { recursive: true, force: true }));
  const appPort = await availablePort();
  const paypalBase = `http://127.0.0.1:${paypal.address().port}`;
  const app = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      PORT: String(appPort),
      DATA_PATH: path.join(tempRoot, 'data'),
      STORAGE_PATH: path.join(tempRoot, 'storage'),
      PAYPAL_CLIENT_ID: 'env-client',
      PAYPAL_CLIENT_SECRET: 'env-secret',
      PAYPAL_ENVIRONMENT: 'sandbox',
      PAYPAL_API_BASE_URL: paypalBase,
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GOOGLE_REDIRECT_URI: `http://127.0.0.1:${appPort}/api/connections/google/callback`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => app.kill());
  await waitForHealth(appPort, app);
  const baseUrl = `http://127.0.0.1:${appPort}`;

  const adminRegister = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Admin User', email: 'admin@example.test', password: 'testing-password' }),
  });
  const adminCookie = adminRegister.headers.get('set-cookie').split(';')[0];
  const userRegister = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Billing User', email: 'user@example.test', password: 'testing-password' }),
  });
  const userCookie = userRegister.headers.get('set-cookie').split(';')[0];

  const initialBilling = await fetch(`${baseUrl}/api/admin/billing`, { headers: { Cookie: adminCookie } });
  assert.equal(initialBilling.status, 200);
  const initialPayload = await initialBilling.json();
  assert.equal(initialPayload.paypal.source, 'environment');
  assert.equal(initialPayload.paypal.clientSecretConfigured, true);
  assert.equal(initialPayload.plans.free.id, 'free');
  assert.equal(initialPayload.plans.paid.id, 'paid');

  const updatedBilling = await fetch(`${baseUrl}/api/admin/billing`, {
    method: 'PATCH',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paypal: {
        clientId: 'dashboard-client',
        clientSecret: 'dashboard-secret',
        environment: 'sandbox',
        currency: 'USD',
      },
      plans: {
        free: {
          name: 'Starter',
          description: 'Free for personal use',
          active: true,
          featured: false,
          priceCents: 0,
          currency: 'USD',
          storageLimitBytes: 10 * 1024 ** 3,
        },
        paid: {
          name: 'Plus',
          description: 'More storage with PayPal',
          active: true,
          featured: true,
          priceCents: 1299,
          currency: 'USD',
          storageLimitBytes: 200 * 1024 ** 3,
        },
      },
    }),
  });
  assert.equal(updatedBilling.status, 200);
  const updatedPayload = await updatedBilling.json();
  assert.equal(updatedPayload.paypal.source, 'dashboard');
  assert.equal(updatedPayload.paypal.clientSecretConfigured, true);
  assert.equal(updatedPayload.plans.free.name, 'Starter');
  assert.equal(updatedPayload.plans.paid.name, 'Plus');
  assert.equal(JSON.stringify(updatedPayload).includes('dashboard-secret'), false, 'dashboard secret must never be returned by the API');

  const billingFile = await readFile(path.join(tempRoot, 'data', 'billing.json'), 'utf8');
  assert.equal(billingFile.includes('dashboard-secret'), false, 'dashboard secret must be encrypted at rest');

  const userBilling = await fetch(`${baseUrl}/api/billing/plans`, { headers: { Cookie: userCookie } });
  const userBillingPayload = await userBilling.json();
  assert.equal(userBillingPayload.currentPlanId, 'free');
  assert.equal(userBillingPayload.plans.find((plan) => plan.id === 'paid').name, 'Plus');
  assert.equal(userBillingPayload.paypalConfigured, true);

  const checkout = await fetch(`${baseUrl}/api/billing/paypal/create-order`, {
    method: 'POST',
    headers: { Cookie: userCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: 'paid' }),
  });
  assert.equal(checkout.status, 200);
  const checkoutPayload = await checkout.json();
  assert.equal(checkoutPayload.orderId, 'order-1');
  assert.equal(checkoutPayload.approvalUrl, 'http://paypal.test/approve/order-1');
  assert.equal(tokenAuth, 'Basic ' + Buffer.from('dashboard-client:dashboard-secret').toString('base64'));
  assert.equal(orderBody.purchase_units[0].amount.value, '12.99');

  const callback = await fetch(`${baseUrl}/api/billing/paypal/return?state=${encodeURIComponent(checkoutPayload.state)}&token=order-1`, { redirect: 'manual' });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/?billing=success&plan=paid');
  assert.equal(captureCount, 1);

  const currentUser = await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: userCookie } })).json();
  assert.equal(currentUser.user.planId, 'paid');
  assert.equal(currentUser.user.planName, 'Plus');

  const status = await (await fetch(`${baseUrl}/api/status`, { headers: { Cookie: userCookie } })).json();
  assert.equal(status.planId, 'paid');
  assert.equal(status.planName, 'Plus');

  const downgrade = await fetch(`${baseUrl}/api/billing/plan`, {
    method: 'POST',
    headers: { Cookie: userCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: 'free' }),
  });
  assert.equal(downgrade.status, 200);
  assert.equal((await downgrade.json()).plan.id, 'free');

  const afterDowngrade = await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: userCookie } })).json();
  assert.equal(afterDowngrade.user.planId, 'free');
  assert.equal(afterDowngrade.user.planName, 'Starter');
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
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {}
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server failed to start: ${errorOutput || 'no stderr output'}`);
}
