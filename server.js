import http from 'node:http';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';

const scrypt = promisify(crypto.scrypt);
const APP_ROOT = path.dirname(fileURLToPath(import.meta.url));
await loadDotEnv(path.join(APP_ROOT, '.env'));
const PUBLIC_ROOT = path.join(APP_ROOT, 'public');
const STORAGE_ROOT = path.resolve(process.env.STORAGE_PATH || path.join(APP_ROOT, 'storage'));
const DATA_ROOT = path.resolve(process.env.DATA_PATH || path.join(APP_ROOT, '.local-cloud-data'));
const USERS_ROOT = path.join(STORAGE_ROOT, 'accounts');
const ACCOUNTS_FILE = path.join(DATA_ROOT, 'accounts.json');
const BILLING_FILE = path.join(DATA_ROOT, 'billing.json');
const BILLING_CHECKOUTS_FILE = path.join(DATA_ROOT, 'billing-checkouts.json');
const CONNECTIONS_FILE = path.join(DATA_ROOT, 'connections.json');
const ENCRYPTION_KEY_FILE = path.join(DATA_ROOT, 'encryption.key');
const SYSTEM_SETTINGS_FILE = path.join(DATA_ROOT, 'system-settings.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = parsePort(process.env.PORT || '8787');
const MAX_FILE_BYTES = parseSize(process.env.MAX_FILE_SIZE || '2GB');
const MAX_STORAGE_BYTES = parseSize(process.env.MAX_STORAGE || '20GB');
const ENV_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const ENV_GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const ENV_GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://127.0.0.1:${PORT}/api/connections/google/callback`;
const ENV_PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const ENV_PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const ENV_PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
const ENV_PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';
const PAYPAL_API_BASE_URL = process.env.PAYPAL_API_BASE_URL || '';
const GOOGLE_AUTH_URL = process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API_URL = process.env.GOOGLE_DRIVE_API_URL || 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_URL = process.env.GOOGLE_DRIVE_UPLOAD_URL || 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE = 'local_cloud_session';

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.pdf', 'application/pdf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.mp3', 'audio/mpeg'],
  ['.zip', 'application/zip'],
]);

await mkdir(DATA_ROOT, { recursive: true });
await mkdir(USERS_ROOT, { recursive: true });
const encryptionKey = await loadEncryptionKey();
let billingSettings = await loadBillingSettings();
let billingCheckouts = await loadBillingCheckouts();
let accounts = await loadAccounts();
let connections = await loadConnections();
let systemSettings = await loadSystemSettings();
const sessions = new Map();
const googleOAuthStates = new Map();
const paypalAccessTokens = new Map();

const server = http.createServer(async (request, response) => {
  setSecurityHeaders(response);

  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (url.pathname === '/health') return json(response, 200, { status: 'ok' });

    if (request.method === 'GET' && url.pathname === '/api/connections/google/callback') {
      return await finishGoogleOAuth(response, url);
    }
    if (request.method === 'GET' && url.pathname === '/api/billing/paypal/return') {
      return await finishPayPalCheckout(response, url);
    }
    if (request.method === 'GET' && url.pathname === '/api/billing/paypal/cancel') {
      return finishPayPalCancel(response, url);
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/register') {
      verifySameOrigin(request);
      return await registerAccount(request, response);
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      verifySameOrigin(request);
      return await loginAccount(request, response);
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      verifySameOrigin(request);
      return logoutAccount(request, response);
    }
    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      const user = authenticate(request);
      return json(response, 200, { user: publicUser(user) });
    }

    if (url.pathname.startsWith('/api/')) {
      const user = authenticate(request);
      const userRoot = await ensureUserRoot(user.id);
      if (request.method !== 'GET' && request.method !== 'HEAD') verifySameOrigin(request);

      if (request.method === 'GET' && url.pathname === '/api/status') {
        const used = await directorySize(userRoot, true);
        return json(response, 200, {
          name: 'SavelyCLOUD',
          used,
          limit: userStorageLimit(user),
          planId: user.planId || defaultPlanId(),
          planName: getBillingPlan(user.planId || defaultPlanId())?.name || 'Free',
          maxFileSize: MAX_FILE_BYTES,
        });
      }
      if (url.pathname.startsWith('/api/admin/')) {
        requireAdmin(user);
        if (request.method === 'GET' && url.pathname === '/api/admin/billing') return await adminBilling(response);
        if (request.method === 'PATCH' && url.pathname === '/api/admin/billing') return await updateAdminBilling(request, response);
        if (request.method === 'GET' && url.pathname === '/api/admin/overview') return await adminOverview(response);
        if (request.method === 'GET' && url.pathname === '/api/admin/users') return await adminUsers(response);
        if (request.method === 'GET' && url.pathname === '/api/admin/settings') return adminSystemSettings(response);
        if (request.method === 'PATCH' && url.pathname === '/api/admin/settings') return await updateAdminSystemSettings(request, response);
        const adminUserRoute = /^\/api\/admin\/users\/([a-f0-9-]+)(?:\/(files|download))?$/.exec(url.pathname);
        if (adminUserRoute) {
          const targetUser = getAccount(adminUserRoute[1]);
          const action = adminUserRoute[2] || '';
          if (request.method === 'PATCH' && !action) return await updateManagedUser(request, response, user, targetUser);
          if (request.method === 'DELETE' && !action) return await removeManagedUser(response, user, targetUser);
          const targetRoot = await ensureUserRoot(targetUser.id);
          const managedPath = url.searchParams.get('path') || '';
          if (request.method === 'GET' && action === 'files') return await listFiles(response, targetRoot, managedPath);
          if (request.method === 'GET' && action === 'download') return await downloadFile(request, response, targetRoot, managedPath);
          if (request.method === 'DELETE' && action === 'files') return await deleteItem(response, targetRoot, managedPath);
        }
        return json(response, 404, { error: 'Admin route not found.' });
      }
      if (request.method === 'GET' && url.pathname === '/api/billing/plans') {
        return billingPlans(response, user);
      }
      if (request.method === 'POST' && url.pathname === '/api/billing/plan') {
        verifySameOrigin(request);
        return await setBillingPlan(request, response, user);
      }
      if (request.method === 'POST' && url.pathname === '/api/billing/paypal/create-order') {
        verifySameOrigin(request);
        return await createPayPalCheckout(request, response, url, user);
      }
      if (request.method === 'GET' && url.pathname === '/api/connections') {
        return json(response, 200, { connections: connections.filter((item) => item.userId === user.id).map(publicConnection) });
      }
      if (request.method === 'GET' && url.pathname === '/api/connections/google/start') {
        return startGoogleOAuth(response, user, url.searchParams.get('name') || 'Google Drive', url.searchParams.get('connectionId') || '');
      }
      if (request.method === 'POST' && url.pathname === '/api/connections') {
        return await createConnection(request, response, user);
      }
      const connectionRoute = /^\/api\/connections\/([a-f0-9-]+)(?:\/(files|download|folders|google-info))?$/.exec(url.pathname);
      if (connectionRoute) {
        const connection = getUserConnection(user.id, connectionRoute[1]);
        const action = connectionRoute[2] || '';
        const remotePath = url.searchParams.get('path') || '';
        if (request.method === 'PATCH' && !action) return await updateConnection(request, response, connection);
        if (request.method === 'DELETE' && !action) return await deleteConnection(response, connection);
        if (request.method === 'POST' && action === 'google-info') return await refreshGoogleConnectionInfo(response, connection);
        if (request.method === 'GET' && action === 'files') return await listRemoteFiles(response, connection, remotePath);
        if (request.method === 'GET' && action === 'download') return await downloadRemoteFile(response, connection, remotePath);
        if (request.method === 'PUT' && action === 'files') return await uploadRemoteFile(request, response, connection, remotePath);
        if (request.method === 'DELETE' && action === 'files') return await deleteRemoteItem(response, connection, remotePath);
        if (request.method === 'POST' && action === 'folders') return await createRemoteFolder(request, response, connection);
      }
      if (request.method === 'GET' && url.pathname === '/api/files') {
        return await listFiles(response, userRoot, url.searchParams.get('path') || '');
      }
      if (request.method === 'PUT' && url.pathname === '/api/files') {
        return await uploadFile(request, response, url, userRoot, userStorageLimit(user));
      }
      if (request.method === 'GET' && url.pathname === '/api/download') {
        return await downloadFile(request, response, userRoot, url.searchParams.get('path') || '');
      }
      if (request.method === 'POST' && url.pathname === '/api/folders') {
        return await createFolder(request, response, userRoot);
      }
      if (request.method === 'DELETE' && url.pathname === '/api/items') {
        return await deleteItem(response, userRoot, url.searchParams.get('path') || '');
      }
      return json(response, 404, { error: 'Route not found.' });
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      return await servePublic(request, response, url.pathname);
    }
    return json(response, 404, { error: 'Route not found.' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error);
    return json(response, statusCode, { error: statusCode >= 500 ? 'Internal server error.' : error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`SavelyCLOUD is ready at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Storage directory: ${STORAGE_ROOT}`);
});

async function registerAccount(request, response) {
  const body = await readJson(request);
  const name = normalizeName(body.name);
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password);
  const requestedPlanId = typeof body.planId === 'string' ? body.planId.trim().toLowerCase() : defaultPlanId();
  const plan = getBillingPlan(requestedPlanId === 'paid' || requestedPlanId === 'free' ? requestedPlanId : defaultPlanId());
  if (!plan.active) throw httpError(400, 'The selected plan is not available.');
  if (accounts.some((account) => account.email === email)) {
    throw httpError(409, 'An account with that email already exists.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    salt,
    passwordHash,
    role: accounts.length === 0 ? 'admin' : 'user',
    status: 'active',
    planId: plan.id,
    planUpdatedAt: new Date().toISOString(),
    storageLimit: null,
    createdAt: new Date().toISOString(),
  };
  accounts.push(user);
  try {
    await saveAccounts();
    await ensureUserRoot(user.id);
  } catch (error) {
    accounts = accounts.filter((account) => account.id !== user.id);
    throw error;
  }
  createSession(response, user.id);
  return json(response, 201, { user: publicUser(user) });
}

async function loginAccount(request, response) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const user = accounts.find((account) => account.email === email);
  const dummySalt = '00000000000000000000000000000000';
  const candidate = await scrypt(password, user?.salt || dummySalt, 64);
  const expected = Buffer.from(user?.passwordHash || '00'.repeat(64), 'hex');
  if (!user || candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) {
    throw httpError(401, 'Email or password is incorrect.');
  }
  if (user.status === 'suspended') throw httpError(403, 'This account has been suspended by an administrator.');
  createSession(response, user.id);
  return json(response, 200, { user: publicUser(user) });
}

function logoutAccount(request, response) {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  clearSessionCookie(response);
  response.writeHead(204);
  response.end();
}

function authenticate(request) {
  purgeExpiredSessions();
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  const user = session ? accounts.find((account) => account.id === session.userId) : null;
  if (!user) throw httpError(401, 'Please sign in to continue.');
  if (user.status === 'suspended') throw httpError(403, 'This account has been suspended by an administrator.');
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return user;
}

function createSession(response, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`);
}

function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

function purgeExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

async function adminOverview(response) {
  const users = await Promise.all(accounts.map(async (account) => {
    const metrics = await directoryMetrics(await ensureUserRoot(account.id));
    return { account, metrics };
  }));
  return json(response, 200, {
    users: accounts.length,
    activeUsers: accounts.filter((account) => account.status !== 'suspended').length,
    files: users.reduce((total, item) => total + item.metrics.files, 0),
    used: users.reduce((total, item) => total + item.metrics.size, 0),
    connections: connections.length,
  });
}

async function adminUsers(response) {
  const managedUsers = await Promise.all(accounts.map(async (account) => {
    const metrics = await directoryMetrics(await ensureUserRoot(account.id));
    return {
      ...publicUser(account),
      status: account.status || 'active',
      storageLimit: userStorageLimit(account),
      used: metrics.size,
      files: metrics.files,
      connections: connections.filter((item) => item.userId === account.id).length,
    };
  }));
  managedUsers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return json(response, 200, { users: managedUsers });
}

function adminSystemSettings(response) {
  const google = googleOAuthConfig();
  return json(response, 200, {
    google: {
      clientId: google.clientId,
      redirectUri: google.redirectUri,
      clientSecretConfigured: Boolean(google.clientSecret),
      source: systemSettings.google ? 'dashboard' : 'environment',
    },
  });
}

async function updateAdminSystemSettings(request, response) {
  const body = await readJson(request);
  if (!body.google || typeof body.google !== 'object' || Array.isArray(body.google)) {
    throw httpError(400, 'Google Drive settings are required.');
  }
  const current = googleOAuthConfig();
  const clientId = requireString(body.google.clientId, 'Google client ID', 500);
  const redirectUri = validateGoogleRedirectUri(body.google.redirectUri);
  const newSecret = typeof body.google.clientSecret === 'string' ? body.google.clientSecret.trim() : '';
  const clientSecret = newSecret || current.clientSecret;
  if (!clientSecret) throw httpError(400, 'Google client secret is required for the first dashboard configuration.');
  const previousEncryptedSecret = systemSettings.google?.encryptedClientSecret;
  systemSettings = {
    ...systemSettings,
    google: {
      clientId,
      redirectUri,
      encryptedClientSecret: newSecret ? encryptSecret({ clientSecret }) : previousEncryptedSecret,
      updatedAt: new Date().toISOString(),
    },
  };
  await saveSystemSettings();
  return adminSystemSettings(response);
}

function adminBilling(response) {
  const paypal = paypalConfig();
  return json(response, 200, {
    paypal: {
      clientId: paypal.clientId,
      currency: paypal.currency,
      environment: paypal.environment,
      clientSecretConfigured: Boolean(paypal.clientSecret),
      source: billingSettings.source === 'dashboard' ? 'dashboard' : 'environment',
    },
    plans: {
      free: publicBillingPlan(getBillingPlan('free')),
      paid: publicBillingPlan(getBillingPlan('paid')),
    },
  });
}

async function updateAdminBilling(request, response) {
  const body = await readJson(request);
  if (!body.paypal || typeof body.paypal !== 'object' || Array.isArray(body.paypal)) {
    throw httpError(400, 'PayPal settings are required.');
  }
  if (!body.plans || typeof body.plans !== 'object' || Array.isArray(body.plans)) {
    throw httpError(400, 'Plan settings are required.');
  }

  const current = paypalConfig();
  const clientId = requireString(body.paypal.clientId, 'PayPal client ID', 500);
  const environment = normalizePayPalEnvironment(body.paypal.environment);
  const currency = normalizeCurrencyCode(body.paypal.currency || current.currency);
  const newSecret = typeof body.paypal.clientSecret === 'string' ? body.paypal.clientSecret.trim() : '';
  const clientSecret = newSecret || current.clientSecret;
  if (!clientSecret) throw httpError(400, 'PayPal client secret is required for the first dashboard configuration.');

  const freePlan = normalizeBillingPlan(body.plans.free, 'free', billingSettings.plans.free);
  const paidPlan = normalizeBillingPlan(body.plans.paid, 'paid', billingSettings.plans.paid);
  if (!freePlan.active) throw httpError(400, 'The free plan must stay active.');
  if (freePlan.priceCents !== 0) throw httpError(400, 'The free plan price must be zero.');
  if (paidPlan.priceCents <= 0) throw httpError(400, 'The paid plan must have a price greater than zero.');
  if (paidPlan.storageLimitBytes <= freePlan.storageLimitBytes) {
    throw httpError(400, 'The paid plan must allow more storage than the free plan.');
  }

  billingSettings = {
    ...billingSettings,
    source: 'dashboard',
    paypal: {
      clientId,
      environment,
      currency,
      encryptedClientSecret: newSecret ? encryptSecret({ clientSecret }) : billingSettings.paypal?.encryptedClientSecret,
      updatedAt: new Date().toISOString(),
    },
    plans: {
      free: {
        ...freePlan,
        priceCents: 0,
        currency,
      },
      paid: {
        ...paidPlan,
        currency,
      },
    },
  };
  await saveBillingSettings();
  return adminBilling(response);
}

function billingPlans(response, user) {
  const paypal = paypalConfig();
  const currentPlan = getBillingPlan(user.planId || defaultPlanId());
  return json(response, 200, {
    paypalConfigured: Boolean(paypal.clientId && paypal.clientSecret),
    currency: paypal.currency,
    currentPlanId: currentPlan.id,
    currentPlan: publicBillingPlan(currentPlan),
    plans: listPublicBillingPlans(),
  });
}

async function setBillingPlan(request, response, user) {
  const body = await readJson(request);
  const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
  const plan = getBillingPlan(planId);
  if (plan.id !== 'free') throw httpError(402, 'Paid plans require PayPal checkout.');
  user.planId = plan.id;
  user.planUpdatedAt = new Date().toISOString();
  await saveAccounts();
  return json(response, 200, { user: publicUser(user), plan: publicBillingPlan(plan) });
}

async function createPayPalCheckout(request, response, url, user) {
  const body = await readJson(request);
  const planId = typeof body.planId === 'string' ? body.planId.trim() : '';
  const plan = getBillingPlan(planId);
  if (plan.id === 'free') throw httpError(400, 'Choose a paid plan to pay with PayPal.');
  if (!plan.active) throw httpError(400, 'That plan is not active.');
  const paypal = paypalConfig();
  if (!paypal.clientId || !paypal.clientSecret) {
    throw httpError(503, 'PayPal is not configured. An administrator can add the PayPal credentials in Admin panel > Billing.');
  }

  const state = crypto.randomBytes(24).toString('base64url');
  const orderReturnBase = `${url.origin}/api/billing/paypal/return`;
  const orderCancelBase = `${url.origin}/api/billing/paypal/cancel`;
  const pending = {
    state,
    orderId: '',
    userId: user.id,
    planId: plan.id,
    priceCents: plan.priceCents,
    currency: paypal.currency,
    createdAt: new Date().toISOString(),
  };

  const orderResponse = await fetch(`${paypalApiBaseUrl(paypal)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID(),
      Authorization: `Bearer ${await paypalAccessTokenFor(paypal)}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: plan.id,
        description: plan.description || plan.name,
        amount: {
          currency_code: paypal.currency,
          value: (plan.priceCents / 100).toFixed(2),
        },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: `${orderReturnBase}?state=${encodeURIComponent(state)}`,
            cancel_url: `${orderCancelBase}?state=${encodeURIComponent(state)}`,
          },
        },
      },
    }),
  });
  if (!orderResponse.ok) throw await paypalApiError(orderResponse);
  const order = await orderResponse.json();
  pending.orderId = order.id;
  billingCheckouts = billingCheckouts.filter((item) => item.state !== state).concat(pending);
  await saveBillingCheckouts();
  const approvalUrl = order.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve')?.href;
  if (!approvalUrl) throw httpError(502, 'PayPal did not provide an approval link.');
  return json(response, 200, { orderId: order.id, state, approvalUrl, plan: publicBillingPlan(plan) });
}

async function finishPayPalCheckout(response, url) {
  const state = url.searchParams.get('state') || '';
  const orderId = url.searchParams.get('token') || '';
  const pending = billingCheckouts.find((item) => item.state === state && item.orderId === orderId);
  if (!pending) return redirect(response, '/?billing=invalid');
  const paypal = paypalConfig();
  try {
    const captureResponse = await fetch(`${paypalApiBaseUrl(paypal)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PayPal-Request-Id': crypto.randomUUID(),
        Authorization: `Bearer ${await paypalAccessTokenFor(paypal)}`,
      },
      body: '{}',
    });
    if (!captureResponse.ok) throw await paypalApiError(captureResponse);
    const user = getAccount(pending.userId);
    user.planId = pending.planId;
    user.planUpdatedAt = new Date().toISOString();
    billingCheckouts = billingCheckouts.filter((item) => item.state !== state);
    await Promise.all([saveAccounts(), saveBillingCheckouts()]);
    return redirect(response, `/?billing=success&plan=${encodeURIComponent(pending.planId)}`);
  } catch (error) {
    return redirect(response, `/?billing=error&message=${encodeURIComponent(error.message || 'PayPal checkout failed')}`);
  }
}

function finishPayPalCancel(response, url) {
  const state = url.searchParams.get('state') || '';
  billingCheckouts = billingCheckouts.filter((item) => item.state !== state);
  void saveBillingCheckouts();
  return redirect(response, '/?billing=cancelled');
}

async function updateManagedUser(request, response, admin, targetUser) {
  const body = await readJson(request);
  if (body.status !== undefined) {
    if (!['active', 'suspended'].includes(body.status)) throw httpError(400, 'Status must be active or suspended.');
    if (targetUser.id === admin.id && body.status === 'suspended') throw httpError(400, 'You cannot suspend your own account.');
    targetUser.status = body.status;
    if (body.status === 'suspended') revokeUserSessions(targetUser.id);
  }
  if (body.role !== undefined) {
    if (!['admin', 'user'].includes(body.role)) throw httpError(400, 'Role must be admin or user.');
    if (targetUser.id === admin.id && body.role !== 'admin') throw httpError(400, 'You cannot remove your own admin role.');
    if (targetUser.role === 'admin' && body.role === 'user' && adminCount() <= 1) throw httpError(400, 'SavelyCLOUD must have at least one administrator.');
    targetUser.role = body.role;
  }
  if (body.storageLimit !== undefined) {
    if (body.storageLimit === null || body.storageLimit === '') targetUser.storageLimit = null;
    else {
      const limit = Number(body.storageLimit);
      if (!Number.isSafeInteger(limit) || limit < 1024 ** 2 || limit > 1024 ** 5) {
        throw httpError(400, 'Storage limit must be between 1 MB and 1 PB.');
      }
      targetUser.storageLimit = limit;
    }
  }
  await saveAccounts();
  return json(response, 200, { user: publicUser(targetUser), status: targetUser.status, storageLimit: userStorageLimit(targetUser) });
}

async function removeManagedUser(response, admin, targetUser) {
  if (targetUser.id === admin.id) throw httpError(400, 'You cannot delete your own account.');
  if (targetUser.role === 'admin' && adminCount() <= 1) throw httpError(400, 'SavelyCLOUD must have at least one administrator.');
  accounts = accounts.filter((account) => account.id !== targetUser.id);
  connections = connections.filter((connection) => connection.userId !== targetUser.id);
  revokeUserSessions(targetUser.id);
  await Promise.all([saveAccounts(), saveConnections()]);
  await rm(path.join(USERS_ROOT, targetUser.id), { recursive: true, force: true });
  response.writeHead(204);
  response.end();
}

function requireAdmin(user) {
  if (user.role !== 'admin') throw httpError(403, 'Administrator access is required.');
}

function getAccount(userId) {
  const account = accounts.find((item) => item.id === userId);
  if (!account) throw httpError(404, 'User account not found.');
  return account;
}

function adminCount() {
  return accounts.filter((account) => account.role === 'admin').length;
}

function revokeUserSessions(userId) {
  for (const [token, session] of sessions) if (session.userId === userId) sessions.delete(token);
}

function userStorageLimit(user) {
  if (Number.isSafeInteger(user.storageLimit) && user.storageLimit > 0) return user.storageLimit;
  return userBillingPlan(user)?.storageLimitBytes || MAX_STORAGE_BYTES;
}

function startGoogleOAuth(response, user, requestedName, replacementId = '') {
  const googleConfig = googleOAuthConfig();
  if (!googleConfig.clientId || !googleConfig.clientSecret) {
    throw httpError(503, 'Google Drive is not configured. An administrator can add its OAuth credentials in Admin panel > System settings.');
  }
  const name = typeof requestedName === 'string' ? requestedName.trim() : '';
  if (name.length < 2 || name.length > 60) throw httpError(400, 'Connection name must be between 2 and 60 characters.');
  if (replacementId) {
    const replacement = getUserConnection(user.id, replacementId);
    if (replacement.provider !== 'google') throw httpError(400, 'Only Google Drive connections can use Google reconnection.');
  }
  purgeGoogleOAuthStates();
  const state = crypto.randomBytes(32).toString('base64url');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  googleOAuthStates.set(state, { userId: user.id, name, replacementId, verifier, googleConfig, expiresAt: Date.now() + 10 * 60 * 1000 });
  const authorizationUrl = new URL(GOOGLE_AUTH_URL);
  authorizationUrl.search = new URLSearchParams({
    client_id: googleConfig.clientId,
    redirect_uri: googleConfig.redirectUri,
    response_type: 'code',
    scope: GOOGLE_DRIVE_SCOPE,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return json(response, 200, { authorizationUrl: authorizationUrl.toString() });
}

async function finishGoogleOAuth(response, url) {
  purgeGoogleOAuthStates();
  const stateValue = url.searchParams.get('state') || '';
  const pending = googleOAuthStates.get(stateValue);
  googleOAuthStates.delete(stateValue);
  if (!pending) return redirect(response, '/?google=invalid-state');
  if (url.searchParams.get('error')) return redirect(response, '/?google=denied');
  const code = url.searchParams.get('code');
  if (!code) return redirect(response, '/?google=missing-code');
  const user = accounts.find((account) => account.id === pending.userId && account.status !== 'suspended');
  if (!user) return redirect(response, '/?google=account-unavailable');

  try {
    const googleConfig = pending.googleConfig || googleOAuthConfig();
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleConfig.clientId,
        client_secret: googleConfig.clientSecret,
        redirect_uri: googleConfig.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: pending.verifier,
      }),
    });
    if (!tokenResponse.ok) throw await remoteProviderError(tokenResponse);
    const tokens = await tokenResponse.json();
    if (!tokens.access_token || !tokens.refresh_token) throw new Error('Google did not return offline access. Revoke the previous grant and try connecting again.');
    let accountEmail = '';
    try {
      const aboutResponse = await fetch(`${GOOGLE_DRIVE_API_URL}/about?fields=user`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (aboutResponse.ok) accountEmail = (await aboutResponse.json()).user?.emailAddress || '';
    } catch {}
    const encryptedSecret = encryptSecret({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000,
    });
    const replacement = pending.replacementId
      ? connections.find((item) => item.id === pending.replacementId && item.userId === user.id && item.provider === 'google')
      : null;
    if (pending.replacementId && !replacement) throw new Error('The Google Drive connection being updated no longer exists.');
    if (replacement) {
      replacement.name = pending.name;
      replacement.config = { accountEmail };
      replacement.encryptedSecret = encryptedSecret;
      replacement.updatedAt = new Date().toISOString();
    } else {
      connections.push({
        id: crypto.randomUUID(),
        userId: user.id,
        name: pending.name,
        provider: 'google',
        config: { accountEmail },
        encryptedSecret,
        createdAt: new Date().toISOString(),
      });
    }
    await saveConnections();
    return redirect(response, '/?google=connected');
  } catch (error) {
    console.error('Google OAuth callback failed:', error.message);
    return redirect(response, `/?google=error&message=${encodeURIComponent(error.message.slice(0, 160))}`);
  }
}

function purgeGoogleOAuthStates() {
  const now = Date.now();
  for (const [state, pending] of googleOAuthStates) if (pending.expiresAt <= now) googleOAuthStates.delete(state);
}

function redirect(response, location) {
  response.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  response.end();
}

async function directoryMetrics(directory, skipTemp = true) {
  let size = 0;
  let files = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if ((skipTemp && entry.name === '.tmp') || entry.isSymbolicLink()) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const child = await directoryMetrics(target, false);
      size += child.size;
      files += child.files;
    } else if (entry.isFile()) {
      size += (await stat(target)).size;
      files += 1;
    }
  }
  return { size, files };
}

async function createConnection(request, response, user) {
  const body = await readJson(request);
  const provider = ['webdav', 's3', 'supabase'].includes(body.provider) ? body.provider : null;
  if (!provider) throw httpError(400, 'Choose WebDAV, Supabase, or S3-compatible storage.');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 60) throw httpError(400, 'Connection name must be between 2 and 60 characters.');

  let config;
  let secret;
  if (provider === 'webdav') {
    config = { baseUrl: normalizeProviderUrl(body.baseUrl, true) };
    secret = {
      username: requireString(body.username, 'Username', 200),
      password: requireString(body.password, 'Password', 500),
    };
  } else if (provider === 'supabase') {
    config = supabaseStorageConfig(body);
    secret = {
      accessKeyId: requireString(body.accessKeyId, 'Access key ID', 300),
      secretAccessKey: requireString(body.secretAccessKey, 'Secret access key', 500),
    };
  } else {
    config = {
      endpoint: normalizeProviderUrl(body.endpoint, false),
      region: requireString(body.region || 'us-east-1', 'Region', 80),
      bucket: requireString(body.bucket, 'Bucket', 200),
      prefix: normalizeRemotePath(body.prefix || ''),
    };
    secret = {
      accessKeyId: requireString(body.accessKeyId, 'Access key ID', 300),
      secretAccessKey: requireString(body.secretAccessKey, 'Secret access key', 500),
    };
  }

  const candidate = {
    id: crypto.randomUUID(),
    userId: user.id,
    name,
    provider,
    config,
    encryptedSecret: encryptSecret(secret),
    createdAt: new Date().toISOString(),
  };
  try {
    await providerList(candidate, '');
  } catch (error) {
    throw httpError(400, `Could not connect: ${error.message}`);
  }
  connections.push(candidate);
  await saveConnections();
  return json(response, 201, { connection: publicConnection(candidate) });
}

async function deleteConnection(response, connection) {
  connections = connections.filter((item) => item.id !== connection.id);
  await saveConnections();
  response.writeHead(204);
  response.end();
}

async function updateConnection(request, response, connection) {
  const body = await readJson(request);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 60) throw httpError(400, 'Connection name must be between 2 and 60 characters.');
  if (connection.provider === 'supabase') {
    const currentSecret = decryptSecret(connection.encryptedSecret);
    const config = supabaseStorageConfig(body, connection.config);
    const secret = {
      accessKeyId: typeof body.accessKeyId === 'string' && body.accessKeyId.trim()
        ? requireString(body.accessKeyId, 'Access key ID', 300)
        : currentSecret.accessKeyId,
      secretAccessKey: typeof body.secretAccessKey === 'string' && body.secretAccessKey.trim()
        ? requireString(body.secretAccessKey, 'Secret access key', 500)
        : currentSecret.secretAccessKey,
    };
    const candidate = { ...connection, name, config, encryptedSecret: encryptSecret(secret) };
    try {
      await providerList(candidate, '');
    } catch (error) {
      throw httpError(400, `Could not connect: ${error.message}`);
    }
    connection.config = config;
    connection.encryptedSecret = candidate.encryptedSecret;
  }
  connection.name = name;
  connection.updatedAt = new Date().toISOString();
  await saveConnections();
  return json(response, 200, { connection: publicConnection(connection) });
}

async function refreshGoogleConnectionInfo(response, connection) {
  if (connection.provider !== 'google') throw httpError(400, 'This connection is not Google Drive.');
  const remote = await googleDriveFetch(connection, `${GOOGLE_DRIVE_API_URL}/about?fields=user`);
  if (!remote.ok) throw await remoteProviderError(remote);
  const accountEmail = (await remote.json()).user?.emailAddress || '';
  connection.config.accountEmail = accountEmail;
  connection.updatedAt = new Date().toISOString();
  await saveConnections();
  return json(response, 200, { connection: publicConnection(connection) });
}

async function listRemoteFiles(response, connection, remotePath) {
  const clean = normalizeRemotePath(remotePath);
  const items = await providerList(connection, clean);
  return json(response, 200, { path: clean, items });
}

async function downloadRemoteFile(response, connection, remotePath) {
  const clean = normalizeRemotePath(remotePath);
  if (!clean) throw httpError(400, 'A remote file path is required.');
  let downloadName = path.posix.basename(clean);
  let remote;
  if (connection.provider === 'webdav') remote = await webDavRequest(connection, 'GET', clean);
  else if (connection.provider === 'google') {
    const googleDownload = await downloadGoogleDriveFile(connection, clean);
    remote = googleDownload.response;
    downloadName = googleDownload.fileName;
  } else remote = await s3Request(connection, 'GET', clean);
  if (!remote.ok) throw await remoteProviderError(remote);
  response.statusCode = 200;
  response.setHeader('Content-Type', remote.headers.get('content-type') || 'application/octet-stream');
  const length = remote.headers.get('content-length');
  if (length) response.setHeader('Content-Length', length);
  response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
  if (!remote.body) return response.end();
  Readable.fromWeb(remote.body).pipe(response);
}

async function uploadRemoteFile(request, response, connection, remotePath) {
  const clean = normalizeRemotePath(remotePath);
  if (!clean) throw httpError(400, 'A remote file path is required.');
  const headers = { 'Content-Type': request.headers['content-type'] || 'application/octet-stream' };
  if (request.headers['content-length']) headers['Content-Length'] = request.headers['content-length'];
  let remote;
  if (connection.provider === 'webdav') remote = await webDavRequest(connection, 'PUT', clean, { headers, body: request });
  else if (connection.provider === 'google') remote = await uploadGoogleDriveFile(connection, clean, request, headers);
  else remote = await s3Request(connection, 'PUT', clean, { headers, body: request });
  if (!remote.ok) throw await remoteProviderError(remote);
  return json(response, 201, { path: clean });
}

async function deleteRemoteItem(response, connection, remotePath) {
  const clean = normalizeRemotePath(remotePath);
  if (!clean) throw httpError(400, 'The remote storage root cannot be deleted.');
  let remote;
  if (connection.provider === 'webdav') remote = await webDavRequest(connection, 'DELETE', clean);
  else if (connection.provider === 'google') remote = await deleteGoogleDriveItem(connection, clean);
  else remote = await s3Request(connection, 'DELETE', clean);
  if (!remote.ok && remote.status !== 404) throw await remoteProviderError(remote);
  response.writeHead(204);
  response.end();
}

async function createRemoteFolder(request, response, connection) {
  const body = await readJson(request);
  const clean = normalizeRemotePath(body.path || '');
  if (!clean) throw httpError(400, 'A remote folder path is required.');
  let remote;
  if (connection.provider === 'webdav') remote = await webDavRequest(connection, 'MKCOL', clean);
  else if (connection.provider === 'google') remote = await createGoogleDriveFolder(connection, clean);
  else remote = await s3Request(connection, 'PUT', `${clean.replace(/\/$/, '')}/`, { body: Buffer.alloc(0) });
  if (!remote.ok) throw await remoteProviderError(remote);
  return json(response, 201, { path: clean });
}

function getUserConnection(userId, connectionId) {
  const connection = connections.find((item) => item.id === connectionId && item.userId === userId);
  if (!connection) throw httpError(404, 'Storage connection not found.');
  return connection;
}

function publicConnection(connection) {
  const details = connection.provider === 'webdav'
    ? { baseUrl: connection.config.baseUrl }
    : connection.provider === 'google'
      ? { accountEmail: connection.config.accountEmail || '' }
      : connection.provider === 'supabase'
        ? { projectRef: connection.config.projectRef, region: connection.config.region, bucket: connection.config.bucket, prefix: connection.config.prefix }
        : { endpoint: connection.config.endpoint, region: connection.config.region, bucket: connection.config.bucket, prefix: connection.config.prefix };
  return { id: connection.id, name: connection.name, provider: connection.provider, details, createdAt: connection.createdAt };
}

async function loadBillingSettings() {
  try {
    const data = JSON.parse(await readFile(BILLING_FILE, 'utf8'));
    return normalizeBillingFile(data);
  } catch (error) {
    if (error.code === 'ENOENT') return defaultBillingSettings();
    throw new Error(`Could not load billing settings: ${error.message}`);
  }
}

async function saveBillingSettings() {
  const tempFile = `${BILLING_FILE}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, JSON.stringify({ version: 1, ...billingSettings }, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tempFile, BILLING_FILE);
}

async function loadBillingCheckouts() {
  try {
    const data = JSON.parse(await readFile(BILLING_CHECKOUTS_FILE, 'utf8'));
    return Array.isArray(data.checkouts) ? data.checkouts.filter((item) => item && typeof item === 'object') : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Could not load billing checkouts: ${error.message}`);
  }
}

async function saveBillingCheckouts() {
  const tempFile = `${BILLING_CHECKOUTS_FILE}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, JSON.stringify({ version: 1, checkouts: billingCheckouts }, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tempFile, BILLING_CHECKOUTS_FILE);
}

function defaultBillingSettings() {
  return {
    version: 1,
    source: 'environment',
    paypal: {
      clientId: ENV_PAYPAL_CLIENT_ID,
      clientSecret: ENV_PAYPAL_CLIENT_SECRET ? encryptSecret({ clientSecret: ENV_PAYPAL_CLIENT_SECRET }) : null,
      environment: ENV_PAYPAL_ENVIRONMENT,
      currency: ENV_PAYPAL_CURRENCY,
      updatedAt: new Date().toISOString(),
    },
    plans: {
      free: {
        id: 'free',
        name: 'Free',
        description: 'A simple local cloud for personal files.',
        active: true,
        featured: false,
        priceCents: 0,
        currency: ENV_PAYPAL_CURRENCY,
        storageLimitBytes: MAX_STORAGE_BYTES,
      },
      paid: {
        id: 'paid',
        name: 'Pro',
        description: 'Extra storage and paid plan features.',
        active: true,
        featured: true,
        priceCents: 999,
        currency: ENV_PAYPAL_CURRENCY,
        storageLimitBytes: 100 * 1024 ** 3,
      },
    },
  };
}

function normalizeBillingFile(data) {
  const current = defaultBillingSettings();
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  return {
    version: 1,
    source: source.source === 'dashboard' ? 'dashboard' : 'environment',
    paypal: normalizeBillingPaypalSettings(source.paypal, current.paypal),
    plans: {
      free: normalizeBillingPlan(source.plans?.free, 'free', current.plans.free),
      paid: normalizeBillingPlan(source.plans?.paid, 'paid', current.plans.paid),
    },
  };
}

function normalizeBillingPaypalSettings(value, fallback = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const environment = normalizePayPalEnvironment(source.environment || fallback.environment || ENV_PAYPAL_ENVIRONMENT);
  return {
    clientId: typeof source.clientId === 'string' ? source.clientId.trim() : (fallback.clientId || ENV_PAYPAL_CLIENT_ID),
    clientSecret: source.encryptedClientSecret || fallback.clientSecret || null,
    encryptedClientSecret: source.encryptedClientSecret || fallback.encryptedClientSecret || null,
    environment,
    currency: normalizeCurrencyCode(source.currency || fallback.currency || ENV_PAYPAL_CURRENCY),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : fallback.updatedAt || '',
  };
}

function normalizeBillingPlan(value, id, fallback = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    id,
    name: typeof source.name === 'string' ? source.name.trim() || fallback.name || id : fallback.name || id,
    description: typeof source.description === 'string' ? source.description.trim() || fallback.description || '' : fallback.description || '',
    active: source.active === undefined ? (fallback.active ?? true) : Boolean(source.active),
    featured: source.featured === undefined ? Boolean(fallback.featured) : Boolean(source.featured),
    priceCents: normalizePriceCents(source.priceCents ?? source.price ?? fallback.priceCents ?? 0),
    currency: normalizeCurrencyCode(source.currency || fallback.currency || ENV_PAYPAL_CURRENCY),
    storageLimitBytes: normalizeStorageLimitBytes(source.storageLimitBytes ?? source.storageLimit ?? fallback.storageLimitBytes ?? MAX_STORAGE_BYTES),
  };
}

function publicBillingPlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    active: Boolean(plan.active),
    featured: Boolean(plan.featured),
    priceCents: Number(plan.priceCents || 0),
    currency: normalizeCurrencyCode(plan.currency || ENV_PAYPAL_CURRENCY),
    storageLimitBytes: Number(plan.storageLimitBytes || 0),
  };
}

function listPublicBillingPlans() {
  return ['free', 'paid'].map((id) => publicBillingPlan(getBillingPlan(id)));
}

function getBillingPlan(id) {
  const planId = id === 'paid' ? 'paid' : 'free';
  const fallback = defaultBillingSettings().plans[planId];
  const source = billingSettings.plans?.[planId] || fallback;
  return normalizeBillingPlan(source, planId, fallback);
}

function defaultPlanId() {
  return 'free';
}

function userBillingPlan(user) {
  return getBillingPlan(user.planId || defaultPlanId());
}

function normalizeCurrencyCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw httpError(400, 'Currency must be a three-letter ISO 4217 code.');
  return code;
}

function normalizePayPalEnvironment(value) {
  const environment = String(value || '').trim().toLowerCase();
  if (!['sandbox', 'live'].includes(environment)) {
    throw httpError(400, 'PayPal environment must be sandbox or live.');
  }
  return environment;
}

function normalizePriceCents(value) {
  const cents = typeof value === 'number'
    ? value
    : Number.isFinite(Number(value))
      ? Math.round(Number(value) * 100)
      : NaN;
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100_000_000) {
    throw httpError(400, 'Plan price must be a valid non-negative amount.');
  }
  return cents;
}

function normalizeStorageLimitBytes(value) {
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes < 1024 ** 2 || bytes > 1024 ** 5) {
    throw httpError(400, 'Plan storage limit must be between 1 MB and 1 PB.');
  }
  return bytes;
}

function paypalConfig() {
  const dashboard = billingSettings.paypal || {};
  const clientSecretSource = dashboard.encryptedClientSecret || dashboard.clientSecret;
  let clientSecret = ENV_PAYPAL_CLIENT_SECRET;
  if (clientSecretSource) clientSecret = decryptSecret(clientSecretSource).clientSecret || '';
  return {
    clientId: dashboard.clientId || ENV_PAYPAL_CLIENT_ID,
    clientSecret,
    environment: dashboard.environment || ENV_PAYPAL_ENVIRONMENT,
    currency: dashboard.currency || ENV_PAYPAL_CURRENCY,
  };
}

function paypalApiBaseUrl(config = paypalConfig()) {
  if (PAYPAL_API_BASE_URL) return PAYPAL_API_BASE_URL.replace(/\/$/, '');
  return config.environment === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function paypalCheckoutReturnUrl(baseUrl, state) {
  return `${baseUrl}/api/billing/paypal/return?state=${encodeURIComponent(state)}`;
}

function paypalCheckoutCancelUrl(baseUrl, state) {
  return `${baseUrl}/api/billing/paypal/cancel?state=${encodeURIComponent(state)}`;
}

async function paypalAccessTokenFor(config = paypalConfig()) {
  const cacheKey = `${paypalApiBaseUrl(config)}:${config.clientId}`;
  const cached = paypalAccessTokens.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.accessToken;
  const response = await fetch(`${paypalApiBaseUrl(config)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw await paypalApiError(response);
  const token = await response.json();
  paypalAccessTokens.set(cacheKey, {
    accessToken: token.access_token,
    expiresAt: Date.now() + Number(token.expires_in || 0) * 1000,
  });
  return token.access_token;
}

async function paypalApiError(response) {
  const body = await response.text();
  let message = `PayPal request failed (${response.status})`;
  try {
    const parsed = JSON.parse(body);
    message = parsed.error_description || parsed.message || parsed.error || message;
  } catch {
    if (body.trim()) message = body.trim();
  }
  return httpError(response.status >= 500 ? 502 : response.status, message);
}

async function loadConnections() {
  try {
    const data = JSON.parse(await readFile(CONNECTIONS_FILE, 'utf8'));
    return Array.isArray(data.connections) ? data.connections : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Could not load storage connections: ${error.message}`);
  }
}

async function saveConnections() {
  const tempFile = `${CONNECTIONS_FILE}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, JSON.stringify({ version: 1, connections }, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tempFile, CONNECTIONS_FILE);
}

async function loadSystemSettings() {
  try {
    const data = JSON.parse(await readFile(SYSTEM_SETTINGS_FILE, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Could not load system settings: ${error.message}`);
  }
}

async function saveSystemSettings() {
  const tempFile = `${SYSTEM_SETTINGS_FILE}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, JSON.stringify({ version: 1, ...systemSettings }, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tempFile, SYSTEM_SETTINGS_FILE);
}

function googleOAuthConfig() {
  const dashboard = systemSettings.google || {};
  let clientSecret = ENV_GOOGLE_CLIENT_SECRET;
  if (dashboard.encryptedClientSecret) clientSecret = decryptSecret(dashboard.encryptedClientSecret).clientSecret || '';
  return {
    clientId: dashboard.clientId || ENV_GOOGLE_CLIENT_ID,
    clientSecret,
    redirectUri: dashboard.redirectUri || ENV_GOOGLE_REDIRECT_URI,
  };
}

async function loadEncryptionKey() {
  try {
    const encoded = (await readFile(ENCRYPTION_KEY_FILE, 'utf8')).trim();
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) throw new Error('Encryption key has an invalid length.');
    return key;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const key = crypto.randomBytes(32);
    await writeFile(ENCRYPTION_KEY_FILE, key.toString('base64'), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return key;
  }
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') };
}

function decryptSecret(value) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(value.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
  } catch {
    throw new Error('Stored credentials could not be decrypted.');
  }
}

async function providerList(connection, remotePath) {
  if (connection.provider === 'webdav') return listWebDav(connection, remotePath);
  if (connection.provider === 'google') return listGoogleDrive(connection, remotePath);
  return listS3(connection, remotePath);
}

async function listWebDav(connection, remotePath) {
  const remote = await webDavRequest(connection, 'PROPFIND', remotePath, {
    headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>',
  });
  if (!remote.ok && remote.status !== 207) throw await remoteProviderError(remote);
  return parseWebDavResponse(await remote.text(), remotePath);
}

async function webDavRequest(connection, method, remotePath, options = {}) {
  const secret = decryptSecret(connection.encryptedSecret);
  const base = new URL(connection.config.baseUrl);
  const clean = normalizeRemotePath(remotePath);
  const encoded = clean.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
  base.pathname = `${basePath}${encoded}`;
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Basic ${Buffer.from(`${secret.username}:${secret.password}`, 'utf8').toString('base64')}`);
  const requestOptions = { method, headers, body: options.body };
  if (options.body && typeof options.body.pipe === 'function') requestOptions.duplex = 'half';
  return fetch(base, requestOptions);
}

function parseWebDavResponse(xml, currentPath) {
  const blocks = xml.match(/<(?:[\w-]+:)?response\b[\s\S]*?<\/(?:[\w-]+:)?response>/gi) || [];
  const items = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const nameValue = xmlTag(block, 'displayname');
    const hrefValue = xmlTag(block, 'href');
    let name = decodeXml(nameValue || '');
    if (!name && hrefValue) {
      try { name = decodeURIComponent(new URL(decodeXml(hrefValue), 'https://local.invalid').pathname.split('/').filter(Boolean).pop() || ''); }
      catch { name = ''; }
    }
    if (index === 0 || !name) continue;
    const type = /<(?:[\w-]+:)?collection\b/i.test(block) ? 'folder' : 'file';
    const size = Number(xmlTag(block, 'getcontentlength') || 0);
    const modifiedRaw = decodeXml(xmlTag(block, 'getlastmodified') || '');
    const modifiedDate = modifiedRaw ? new Date(modifiedRaw) : null;
    items.push({
      name,
      path: path.posix.join(currentPath, name),
      type,
      size: type === 'file' && Number.isFinite(size) ? size : null,
      modified: modifiedDate && !Number.isNaN(modifiedDate.valueOf()) ? modifiedDate.toISOString() : null,
    });
  }
  return sortRemoteItems(items);
}

async function listGoogleDrive(connection, remotePath) {
  const clean = normalizeRemotePath(remotePath);
  const parentId = clean ? (await resolveGoogleDriveItem(connection, clean, true)).id : 'root';
  const files = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({
      q: `'${escapeGoogleQuery(parentId)}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
      pageSize: '1000',
      orderBy: 'folder,name_natural',
      spaces: 'drive',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) query.set('pageToken', pageToken);
    const remote = await googleDriveFetch(connection, `${GOOGLE_DRIVE_API_URL}/files?${query}`);
    if (!remote.ok) throw await remoteProviderError(remote);
    const data = await remote.json();
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken && files.length < 10_000);
  return sortRemoteItems(files.map((file) => ({
    name: file.name,
    path: path.posix.join(clean, file.name),
    type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
    size: file.size === undefined ? null : Number(file.size),
    modified: file.modifiedTime || null,
    native: file.mimeType?.startsWith('application/vnd.google-apps.') || false,
  })));
}

async function resolveGoogleDriveItem(connection, remotePath, requireFolder = false) {
  const segments = normalizeRemotePath(remotePath).split('/').filter(Boolean);
  let parentId = 'root';
  let item = null;
  for (let index = 0; index < segments.length; index += 1) {
    const mustBeFolder = index < segments.length - 1 || requireFolder;
    const clauses = [
      `'${escapeGoogleQuery(parentId)}' in parents`,
      `name = '${escapeGoogleQuery(segments[index])}'`,
      'trashed = false',
    ];
    if (mustBeFolder) clauses.push(`mimeType = 'application/vnd.google-apps.folder'`);
    const query = new URLSearchParams({
      q: clauses.join(' and '),
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      pageSize: '2',
      spaces: 'drive',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    const remote = await googleDriveFetch(connection, `${GOOGLE_DRIVE_API_URL}/files?${query}`);
    if (!remote.ok) throw await remoteProviderError(remote);
    const matches = (await remote.json()).files || [];
    if (!matches.length) throw httpError(404, `Google Drive item not found: ${segments[index]}`);
    item = matches[0];
    parentId = item.id;
  }
  if (!item) throw httpError(404, 'Google Drive item not found.');
  return item;
}

async function uploadGoogleDriveFile(connection, remotePath, request, sourceHeaders) {
  const clean = normalizeRemotePath(remotePath);
  const name = path.posix.basename(clean);
  const parentPath = path.posix.dirname(clean) === '.' ? '' : path.posix.dirname(clean);
  const parentId = parentPath ? (await resolveGoogleDriveItem(connection, parentPath, true)).id : 'root';
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Upload-Content-Type': sourceHeaders['Content-Type'] || 'application/octet-stream',
  };
  if (sourceHeaders['Content-Length']) headers['X-Upload-Content-Length'] = sourceHeaders['Content-Length'];
  const start = await googleDriveFetch(connection, `${GOOGLE_DRIVE_UPLOAD_URL}/files?uploadType=resumable&supportsAllDrives=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, parents: [parentId] }),
  });
  if (!start.ok) return start;
  const sessionUrl = start.headers.get('location');
  if (!sessionUrl) throw new Error('Google Drive did not return an upload session URL.');
  const uploadHeaders = {
    'Content-Type': sourceHeaders['Content-Type'] || 'application/octet-stream',
    Authorization: `Bearer ${await googleDriveAccessToken(connection)}`,
  };
  if (sourceHeaders['Content-Length']) uploadHeaders['Content-Length'] = sourceHeaders['Content-Length'];
  return fetch(sessionUrl, { method: 'PUT', headers: uploadHeaders, body: request, duplex: 'half' });
}

async function downloadGoogleDriveFile(connection, remotePath) {
  const item = await resolveGoogleDriveItem(connection, remotePath);
  if (item.mimeType === 'application/vnd.google-apps.folder') throw httpError(400, 'Folders cannot be downloaded as files.');
  const exports = {
    'application/vnd.google-apps.document': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
    'application/vnd.google-apps.spreadsheet': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
    'application/vnd.google-apps.presentation': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx'],
    'application/vnd.google-apps.drawing': ['application/pdf', '.pdf'],
  };
  const exportInfo = exports[item.mimeType];
  if (exportInfo) {
    const response = await googleDriveFetch(connection, `${GOOGLE_DRIVE_API_URL}/files/${encodeURIComponent(item.id)}/export?mimeType=${encodeURIComponent(exportInfo[0])}`);
    const fileName = item.name.toLowerCase().endsWith(exportInfo[1]) ? item.name : `${item.name}${exportInfo[1]}`;
    return { response, fileName };
  }
  if (item.mimeType?.startsWith('application/vnd.google-apps.')) throw httpError(400, 'This Google file type cannot be exported.');
  const response = await googleDriveFetch(connection, `${GOOGLE_DRIVE_API_URL}/files/${encodeURIComponent(item.id)}?alt=media&supportsAllDrives=true`);
  return { response, fileName: item.name };
}

async function deleteGoogleDriveItem(connection, remotePath) {
  const item = await resolveGoogleDriveItem(connection, remotePath);
  return googleDriveFetch(connection, `${GOOGLE_DRIVE_API_URL}/files/${encodeURIComponent(item.id)}?supportsAllDrives=true`, { method: 'DELETE' });
}

async function createGoogleDriveFolder(connection, remotePath) {
  const clean = normalizeRemotePath(remotePath);
  const name = path.posix.basename(clean);
  const parentPath = path.posix.dirname(clean) === '.' ? '' : path.posix.dirname(clean);
  const parentId = parentPath ? (await resolveGoogleDriveItem(connection, parentPath, true)).id : 'root';
  return googleDriveFetch(connection, `${GOOGLE_DRIVE_API_URL}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
}

async function googleDriveFetch(connection, url, options = {}, forceRefresh = false) {
  const accessToken = await googleDriveAccessToken(connection, forceRefresh);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && !forceRefresh && !(options.body && typeof options.body.pipe === 'function')) {
    return googleDriveFetch(connection, url, options, true);
  }
  return response;
}

async function googleDriveAccessToken(connection, forceRefresh = false) {
  const secret = decryptSecret(connection.encryptedSecret);
  if (!forceRefresh && secret.accessToken && Number(secret.expiresAt) > Date.now() + 60_000) return secret.accessToken;
  if (!secret.refreshToken) throw new Error('Google Drive authorization expired. Unlink and reconnect the service.');
  const googleConfig = googleOAuthConfig();
  if (!googleConfig.clientId || !googleConfig.clientSecret) {
    throw httpError(503, 'Google Drive OAuth settings are missing. Ask an administrator to configure them in the Admin panel.');
  }
  const refresh = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleConfig.clientId,
      client_secret: googleConfig.clientSecret,
      refresh_token: secret.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!refresh.ok) throw await remoteProviderError(refresh);
  const tokens = await refresh.json();
  secret.accessToken = tokens.access_token;
  secret.expiresAt = Date.now() + Number(tokens.expires_in || 3600) * 1000;
  if (tokens.refresh_token) secret.refreshToken = tokens.refresh_token;
  connection.encryptedSecret = encryptSecret(secret);
  await saveConnections();
  return secret.accessToken;
}

function escapeGoogleQuery(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

async function listS3(connection, remotePath) {
  const folder = normalizeRemotePath(remotePath);
  const prefixBase = connection.config.prefix ? `${connection.config.prefix.replace(/\/$/, '')}/` : '';
  const listPrefix = `${prefixBase}${folder ? `${folder.replace(/\/$/, '')}/` : ''}`;
  const remote = await s3Request(connection, 'GET', '', {
    query: { 'list-type': '2', delimiter: '/', prefix: listPrefix },
  });
  if (!remote.ok) throw await remoteProviderError(remote);
  const xml = await remote.text();
  const items = [];
  for (const block of xml.match(/<CommonPrefixes>[\s\S]*?<\/CommonPrefixes>/gi) || []) {
    const key = decodeXml(xmlTag(block, 'Prefix') || '');
    const name = key.slice(listPrefix.length).replace(/\/$/, '');
    if (name && !name.includes('/')) items.push({ name, path: path.posix.join(folder, name), type: 'folder', size: null, modified: null });
  }
  for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/gi) || []) {
    const key = decodeXml(xmlTag(block, 'Key') || '');
    const name = key.slice(listPrefix.length);
    if (!name || name.includes('/') || name.endsWith('/')) continue;
    const size = Number(xmlTag(block, 'Size') || 0);
    const modified = xmlTag(block, 'LastModified');
    items.push({ name, path: path.posix.join(folder, name), type: 'file', size, modified: modified || null });
  }
  return sortRemoteItems(items);
}

async function s3Request(connection, method, remotePath, options = {}) {
  const secret = decryptSecret(connection.encryptedSecret);
  const endpoint = new URL(connection.config.endpoint);
  const prefix = connection.config.prefix ? `${connection.config.prefix.replace(/\/$/, '')}/` : '';
  const clean = normalizeRemotePath(remotePath);
  const key = `${prefix}${clean}`;
  const pathParts = [connection.config.bucket, ...key.split('/').filter(Boolean)].map(awsEncode);
  const trailingSlash = key.endsWith('/') ? '/' : '';
  const endpointPath = endpoint.pathname.replace(/\/$/, '');
  endpoint.pathname = `${endpointPath}/${pathParts.join('/')}${trailingSlash}`;
  const queryEntries = Object.entries(options.query || {}).sort(([a], [b]) => a.localeCompare(b));
  endpoint.search = queryEntries.map(([name, value]) => `${awsEncode(name)}=${awsEncode(value)}`).join('&');

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = options.body ? 'UNSIGNED-PAYLOAD' : sha256Hex('');
  const canonicalHeaders = `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [method, endpoint.pathname, endpoint.search.slice(1), canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${connection.config.region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret.secretAccessKey}`, dateStamp), connection.config.region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const headers = new Headers(options.headers || {});
  headers.set('x-amz-date', amzDate);
  headers.set('x-amz-content-sha256', payloadHash);
  headers.set('Authorization', `AWS4-HMAC-SHA256 Credential=${secret.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`);
  const requestOptions = { method, headers, body: options.body };
  if (options.body && typeof options.body.pipe === 'function') requestOptions.duplex = 'half';
  return fetch(endpoint, requestOptions);
}

function sortRemoteItems(items) {
  return items.sort((a, b) => a.type !== b.type
    ? (a.type === 'folder' ? -1 : 1)
    : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

async function remoteProviderError(remote) {
  let detail = '';
  try { detail = (await remote.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240); } catch {}
  return new Error(`Provider returned ${remote.status}${detail ? `: ${detail}` : ''}`);
}

function xmlTag(xml, tag) {
  const match = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i').exec(xml);
  return match?.[1]?.trim() || '';
}

function decodeXml(value) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function normalizeRemotePath(value) {
  const raw = typeof value === 'string' ? value.trim().replaceAll('\\', '/') : '';
  if (raw.includes('\0')) throw httpError(400, 'Invalid remote path.');
  const clean = path.posix.normalize(`/${raw}`).slice(1);
  return clean === '.' ? '' : clean;
}

function normalizeProviderUrl(value, trailingSlash) {
  let url;
  try { url = new URL(typeof value === 'string' ? value.trim() : ''); }
  catch { throw httpError(400, 'Enter a valid provider URL.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw httpError(400, 'Provider URL must use HTTP or HTTPS.');
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHost) throw httpError(400, 'Online provider URLs must use HTTPS.');
  if (url.username || url.password) throw httpError(400, 'Put credentials in the dedicated fields, not the URL.');
  url.search = '';
  url.hash = '';
  if (trailingSlash && !url.pathname.endsWith('/')) url.pathname += '/';
  if (!trailingSlash) url.pathname = url.pathname.replace(/\/$/, '');
  return url.toString().replace(/\/$/, trailingSlash ? '/' : '');
}

function validateGoogleRedirectUri(value) {
  const raw = requireString(value, 'Google redirect URI', 2048);
  let url;
  try { url = new URL(raw); }
  catch { throw httpError(400, 'Enter a valid Google redirect URI.'); }
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost)) {
    throw httpError(400, 'Google redirect URI must use HTTPS, except for localhost development.');
  }
  if (url.username || url.password || url.search || url.hash) throw httpError(400, 'Google redirect URI cannot contain credentials, a query, or a fragment.');
  if (url.pathname !== '/api/connections/google/callback') {
    throw httpError(400, 'Google redirect URI must end with /api/connections/google/callback.');
  }
  return url.toString();
}

function supabaseStorageConfig(body, current = {}) {
  const projectRef = requireString(body.projectRef ?? current.projectRef, 'Supabase project reference', 80).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(projectRef)) throw httpError(400, 'Supabase project reference contains invalid characters.');
  const savedEndpoint = current.projectRef === projectRef ? current.endpoint : '';
  const endpoint = body.endpoint || savedEndpoint
    ? normalizeProviderUrl(body.endpoint || savedEndpoint, false)
    : `https://${projectRef}.storage.supabase.co/storage/v1/s3`;
  return {
    projectRef,
    endpoint,
    region: requireString(body.region ?? current.region ?? 'us-east-1', 'Region', 80),
    bucket: requireString(body.bucket ?? current.bucket, 'Bucket', 200),
    prefix: normalizeRemotePath(body.prefix ?? current.prefix ?? ''),
  };
}

function requireString(value, label, maxLength) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > maxLength) throw httpError(400, `${label} is required and must be under ${maxLength} characters.`);
  return result;
}

function awsEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

async function loadAccounts() {
  try {
    const data = JSON.parse(await readFile(ACCOUNTS_FILE, 'utf8'));
    if (!Array.isArray(data.accounts)) return [];
    const hasAdmin = data.accounts.some((account) => account.role === 'admin');
    return data.accounts.map((account, index) => ({
      ...account,
      role: account.role === 'admin' || account.role === 'user' ? account.role : (!hasAdmin && index === 0 ? 'admin' : 'user'),
      status: account.status === 'suspended' ? 'suspended' : 'active',
      planId: account.planId === 'paid' ? 'paid' : 'free',
      planUpdatedAt: typeof account.planUpdatedAt === 'string' ? account.planUpdatedAt : '',
      storageLimit: Number.isSafeInteger(account.storageLimit) ? account.storageLimit : null,
    }));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Could not load account database: ${error.message}`);
  }
}

async function saveAccounts() {
  const tempFile = `${ACCOUNTS_FILE}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, JSON.stringify({ version: 1, accounts }, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tempFile, ACCOUNTS_FILE);
}

function publicUser(user) {
  const plan = userBillingPlan(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'user',
    createdAt: user.createdAt,
    planId: user.planId || defaultPlanId(),
    planName: plan.name,
    planUpdatedAt: user.planUpdatedAt || '',
  };
}

function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 80) throw httpError(400, 'Name must be between 2 and 80 characters.');
  return name;
}

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, 'Enter a valid email address.');
  }
  return email;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw httpError(400, 'Password must be between 8 and 128 characters.');
  }
  return value;
}

async function ensureUserRoot(userId) {
  const root = path.join(USERS_ROOT, userId);
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  return root;
}

async function listFiles(response, userRoot, relativePath) {
  const { absolute, clean } = safeStoragePath(userRoot, relativePath);
  const info = await statOr404(absolute);
  if (!info.isDirectory()) throw httpError(400, 'The requested path is not a folder.');
  const entries = await readdir(absolute, { withFileTypes: true });
  const items = await Promise.all(entries
    .filter((entry) => entry.name !== '.tmp' && !entry.isSymbolicLink())
    .map(async (entry) => {
      const itemPath = path.posix.join(clean, entry.name);
      const itemStat = await stat(path.join(absolute, entry.name));
      return {
        name: entry.name,
        path: itemPath,
        type: entry.isDirectory() ? 'folder' : 'file',
        size: entry.isFile() ? itemStat.size : null,
        modified: itemStat.mtime.toISOString(),
      };
    }));
  items.sort((a, b) => a.type !== b.type
    ? (a.type === 'folder' ? -1 : 1)
    : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  return json(response, 200, { path: clean, items });
}

async function uploadFile(request, response, url, userRoot, storageLimit) {
  const relativePath = url.searchParams.get('path') || '';
  const overwrite = url.searchParams.get('overwrite') === 'true';
  const { absolute, clean } = safeStoragePath(userRoot, relativePath);
  if (!clean) throw httpError(400, 'A file path is required.');
  const declaredSize = Number(request.headers['content-length'] || 0);
  if (declaredSize > MAX_FILE_BYTES) throw httpError(413, 'File exceeds the configured size limit.');
  if (!overwrite && await exists(absolute)) throw httpError(409, 'A file with that name already exists.');

  const used = await directorySize(userRoot, true);
  let replacedSize = 0;
  if (overwrite && await exists(absolute)) {
    const previous = await stat(absolute);
    if (previous.isDirectory()) throw httpError(409, 'A folder with that name already exists.');
    replacedSize = previous.size;
  }
  if (declaredSize && used - replacedSize + declaredSize > storageLimit) {
    throw httpError(507, 'Not enough storage space within your quota.');
  }

  await mkdir(path.dirname(absolute), { recursive: true });
  await assertNoSymlinkPath(userRoot, path.dirname(absolute));
  const tempPath = path.join(userRoot, '.tmp', `${crypto.randomUUID()}.upload`);
  let received = 0;
  try {
    await new Promise((resolve, reject) => {
      const output = createWriteStream(tempPath, { flags: 'wx' });
      request.on('data', (chunk) => {
        received += chunk.length;
        if (received > MAX_FILE_BYTES || used - replacedSize + received > storageLimit) {
          const error = httpError(received > MAX_FILE_BYTES ? 413 : 507,
            received > MAX_FILE_BYTES ? 'File exceeds the configured size limit.' : 'Storage quota exceeded.');
          request.destroy(error);
          output.destroy(error);
        }
      });
      request.on('aborted', () => reject(httpError(400, 'Upload was interrupted.')));
      request.on('error', reject);
      output.on('error', reject);
      output.on('finish', resolve);
      request.pipe(output);
    });
    if (!overwrite && await exists(absolute)) throw httpError(409, 'A file with that name already exists.');
    if (overwrite && await exists(absolute)) await unlink(absolute);
    await rename(tempPath, absolute);
    return json(response, 201, { path: clean, size: received });
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function downloadFile(request, response, userRoot, relativePath) {
  const { absolute } = safeStoragePath(userRoot, relativePath);
  await assertNoSymlinkPath(userRoot, absolute);
  const info = await statOr404(absolute);
  if (!info.isFile()) throw httpError(400, 'Only files can be downloaded.');
  const contentType = MIME_TYPES.get(path.extname(absolute).toLowerCase()) || 'application/octet-stream';
  const encodedName = encodeURIComponent(path.basename(absolute));
  response.setHeader('Content-Type', contentType);
  response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
  response.setHeader('Accept-Ranges', 'bytes');
  const range = parseRange(request.headers.range, info.size);
  if (range) {
    response.writeHead(206, {
      'Content-Length': range.end - range.start + 1,
      'Content-Range': `bytes ${range.start}-${range.end}/${info.size}`,
    });
    return createReadStream(absolute, range).pipe(response);
  }
  response.writeHead(200, { 'Content-Length': info.size });
  return createReadStream(absolute).pipe(response);
}

async function createFolder(request, response, userRoot) {
  const body = await readJson(request);
  const { absolute, clean } = safeStoragePath(userRoot, body.path || '');
  if (!clean) throw httpError(400, 'A folder path is required.');
  await assertNoSymlinkPath(userRoot, path.dirname(absolute));
  try {
    await mkdir(absolute, { recursive: false });
  } catch (error) {
    if (error.code === 'EEXIST') throw httpError(409, 'An item with that name already exists.');
    if (error.code === 'ENOENT') throw httpError(404, 'The parent folder does not exist.');
    throw error;
  }
  return json(response, 201, { path: clean });
}

async function deleteItem(response, userRoot, relativePath) {
  const { absolute, clean } = safeStoragePath(userRoot, relativePath);
  if (!clean) throw httpError(400, 'The storage root cannot be deleted.');
  await assertNoSymlinkPath(userRoot, absolute);
  await statOr404(absolute);
  await rm(absolute, { recursive: true, force: false });
  response.writeHead(204);
  response.end();
}

async function servePublic(request, response, pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const absolute = path.resolve(PUBLIC_ROOT, relative);
  if (absolute !== PUBLIC_ROOT && !absolute.startsWith(`${PUBLIC_ROOT}${path.sep}`)) throw httpError(403, 'Invalid path.');
  let info;
  try {
    info = await stat(absolute);
  } catch (error) {
    if (error.code === 'ENOENT') throw httpError(404, 'Page not found.');
    throw error;
  }
  if (!info.isFile()) throw httpError(404, 'Page not found.');
  response.writeHead(200, {
    'Content-Type': MIME_TYPES.get(path.extname(absolute)) || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': relative === 'index.html' ? 'no-cache' : 'public, max-age=300',
  });
  if (request.method === 'HEAD') return response.end();
  createReadStream(absolute).pipe(response);
}

function safeStoragePath(root, input) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(input)).replaceAll('\\', '/');
  } catch {
    throw httpError(400, 'Invalid path encoding.');
  }
  if (decoded.includes('\0')) throw httpError(400, 'Invalid path.');
  const clean = path.posix.normalize(`/${decoded}`).slice(1);
  if (clean === '.tmp' || clean.startsWith('.tmp/')) throw httpError(403, 'Reserved path.');
  const absolute = path.resolve(root, ...clean.split('/').filter(Boolean));
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) throw httpError(403, 'Invalid path.');
  return { absolute, clean: clean === '.' ? '' : clean };
}

async function assertNoSymlinkPath(root, target) {
  const relative = path.relative(root, target);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw httpError(403, 'Symbolic links are not allowed.');
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
}

async function directorySize(directory, skipTemp = false) {
  let total = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if ((skipTemp && entry.name === '.tmp') || entry.isSymbolicLink()) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) total += await directorySize(target);
    else if (entry.isFile()) total += (await stat(target)).size;
  }
  return total;
}

function verifySameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  let originHost;
  try { originHost = new URL(origin).host; } catch { throw httpError(403, 'Invalid request origin.'); }
  if (originHost !== request.headers.host) throw httpError(403, 'Cross-origin requests are not allowed.');
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) throw httpError(416, 'Invalid byte range.');
  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;
  if (start === null && end !== null) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else {
    start ??= 0;
    end ??= size - 1;
  }
  if (start < 0 || end >= size || start > end) throw httpError(416, 'Invalid byte range.');
  return { start, end };
}

function parseSize(value) {
  const match = /^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i.exec(String(value).trim());
  if (!match) throw new Error(`Invalid size value: ${value}`);
  const units = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  return Math.floor(Number(match[1]) * units[(match[2] || 'B').toUpperCase()]);
}

async function loadDotEnv(filePath) {
  let content;
  try { content = await readFile(filePath, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  return port;
}

async function readJson(request) {
  const contentType = request.headers['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('application/json')) throw httpError(415, 'Content-Type must be application/json.');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw httpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw httpError(400, 'Request body must be valid JSON.');
  }
}

async function statOr404(target) {
  try { return await stat(target); }
  catch (error) {
    if (error.code === 'ENOENT') throw httpError(404, 'Item not found.');
    throw error;
  }
}

async function exists(target) {
  try { await access(target); return true; }
  catch { return false; }
}

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function json(response, statusCode, data) {
  if (response.headersSent) return;
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'self'");
}

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
