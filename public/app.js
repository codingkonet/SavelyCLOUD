const state = {
  user: null,
  authMode: 'register',
  path: '',
  items: [],
  connections: [],
  currentConnection: null,
  remotePath: '',
  remoteItems: [],
  adminUsers: [],
  managedUser: null,
  adminPath: '',
  adminItems: [],
  googleSettingsConnection: null,
  supabaseSettingsConnection: null,
  billingPlans: [],
  billingCurrentPlanId: 'free',
  billingCurrentPlan: null,
  billingPaypalConfigured: false,
  billingCurrency: 'USD',
  billingAdmin: null,
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  accountActions: $('#app-actions'),
  accountButton: $('#account-button'),
  accountEmail: $('#account-email'),
  accountMenu: $('#account-menu'),
  accountName: $('#account-name'),
  adminPanelButton: $('#admin-panel-button'),
  adminView: $('#admin-view'),
  adminExit: $('#admin-exit-button'),
  adminRefresh: $('#admin-refresh'),
  adminOverviewPanel: $('#admin-overview-panel'),
  adminUserCount: $('#admin-user-count'),
  adminActiveCount: $('#admin-active-count'),
  adminFileCount: $('#admin-file-count'),
  adminStorageUsed: $('#admin-storage-used'),
  adminConnectionCount: $('#admin-connection-count'),
  billingPanel: $('#billing-panel'),
  billingCurrentPlan: $('#billing-current-plan'),
  billingPlanList: $('#billing-plan-list'),
  billingSettingsForm: $('#billing-settings-form'),
  billingSettingsSource: $('#billing-settings-source'),
  billingPaypalClientId: $('#billing-paypal-client-id'),
  billingPaypalClientSecret: $('#billing-paypal-client-secret'),
  billingPaypalSecretStatus: $('#billing-paypal-secret-status'),
  billingPaypalEnvironment: $('#billing-paypal-environment'),
  billingPaypalCurrency: $('#billing-paypal-currency'),
  billingFreeActive: $('#billing-free-active'),
  billingFreeName: $('#billing-free-name'),
  billingFreeDescription: $('#billing-free-description'),
  billingFreeStorage: $('#billing-free-storage'),
  billingPaidActive: $('#billing-paid-active'),
  billingPaidName: $('#billing-paid-name'),
  billingPaidDescription: $('#billing-paid-description'),
  billingPaidPrice: $('#billing-paid-price'),
  billingPaidStorage: $('#billing-paid-storage'),
  billingPaidFeatured: $('#billing-paid-featured'),
  billingSettingsError: $('#billing-settings-error'),
  billingSettingsSave: $('#billing-settings-save'),
  googleSystemSettingsForm: $('#google-system-settings-form'),
  googleSystemClientId: $('#google-system-client-id'),
  googleSystemClientSecret: $('#google-system-client-secret'),
  googleSystemRedirectUri: $('#google-system-redirect-uri'),
  googleSystemSecretStatus: $('#google-system-secret-status'),
  googleSystemSource: $('#google-system-source'),
  googleSystemError: $('#google-system-error'),
  googleSystemSave: $('#google-system-save'),
  adminUserList: $('#admin-user-list'),
  adminUserDetail: $('#admin-user-detail'),
  adminUsersBack: $('#admin-users-back'),
  adminBreadcrumbs: $('#admin-breadcrumbs'),
  adminFileList: $('#admin-file-list'),
  adminFilesEmpty: $('#admin-files-empty'),
  addConnection: $('#add-connection-button'),
  authClose: $('#auth-close'),
  authDialog: $('#auth-dialog'),
  authEmail: $('#auth-email'),
  authError: $('#auth-error'),
  authEyebrow: $('#auth-eyebrow'),
  authForm: $('#auth-form'),
  authName: $('#auth-name'),
  authPassword: $('#auth-password'),
  authPlan: $('#auth-plan'),
  authSubmit: $('#auth-submit'),
  authSubtitle: $('#auth-subtitle'),
  authSwitch: $('#auth-switch'),
  authSwitchCopy: $('#auth-switch-copy'),
  authTitle: $('#auth-title'),
  avatar: $('#avatar'),
  brand: $('#brand-button'),
  breadcrumbs: $('#breadcrumbs'),
  createAccount: $('#create-account-button'),
  connectedStorageTab: $('#connected-storage-tab'),
  connectionClose: $('#connection-close'),
  connectionDialog: $('#connection-dialog'),
  connectionError: $('#connection-error'),
  connectionForm: $('#connection-form'),
  connectionGrid: $('#connection-grid'),
  connectionName: $('#connection-name'),
  connectionProvider: $('#connection-provider'),
  connectionSubmit: $('#connection-submit'),
  connectionsEmpty: $('#connections-empty'),
  connectionsPanel: $('#connections-panel'),
  dashboard: $('#dashboard-view'),
  dropZone: $('#drop-zone'),
  empty: $('#empty-state'),
  fileInput: $('#file-input'),
  fileList: $('#file-list'),
  folderButton: $('#new-folder-button'),
  folderDialog: $('#folder-dialog'),
  folderForm: $('#folder-form'),
  folderName: $('#folder-name'),
  guestActions: $('#guest-actions'),
  googleFields: $('#google-fields'),
  googleSettingsDialog: $('#google-settings-dialog'),
  googleSettingsClose: $('#google-settings-close'),
  googleSettingsForm: $('#google-settings-form'),
  googleSettingsEmail: $('#google-settings-email'),
  googleSettingsName: $('#google-settings-name'),
  googleSettingsError: $('#google-settings-error'),
  googleRefreshInfo: $('#google-refresh-info'),
  googleReconnect: $('#google-reconnect'),
  heroCreate: $('#hero-create-account'),
  heroSignIn: $('#hero-sign-in'),
  home: $('#home-view'),
  localStoragePanel: $('#local-storage-panel'),
  localStorageTab: $('#local-storage-tab'),
  localUploadLabel: $('#local-upload-label'),
  emptyAddConnection: $('#empty-add-connection'),
  remoteBack: $('#remote-back'),
  remoteBreadcrumbs: $('#remote-breadcrumbs'),
  remoteDropZone: $('#remote-drop-zone'),
  remoteEmpty: $('#remote-empty'),
  remoteFileInput: $('#remote-file-input'),
  remoteFileList: $('#remote-file-list'),
  remoteFolderDialog: $('#remote-folder-dialog'),
  remoteFolderForm: $('#remote-folder-form'),
  remoteFolderName: $('#remote-folder-name'),
  remoteNewFolder: $('#remote-new-folder'),
  remotePanel: $('#remote-panel'),
  remoteProviderBadge: $('#remote-provider-badge'),
  search: $('#search-input'),
  signIn: $('#sign-in-button'),
  signOut: $('#sign-out-button'),
  storageCopy: $('#storage-copy'),
  storageMeter: $('#storage-meter'),
  storagePercent: $('#storage-percent'),
  toast: $('#toast'),
  uploadDetail: $('#upload-detail'),
  uploadMeter: $('#upload-meter'),
  uploadPanel: $('#upload-panel'),
  uploadTitle: $('#upload-title'),
  welcomeTitle: $('#welcome-title'),
  webDavFields: $('#webdav-fields'),
  webDavUrl: $('#webdav-url'),
  webDavUsername: $('#webdav-username'),
  webDavPassword: $('#webdav-password'),
  s3Fields: $('#s3-fields'),
  s3Endpoint: $('#s3-endpoint'),
  s3Region: $('#s3-region'),
  s3Bucket: $('#s3-bucket'),
  s3Prefix: $('#s3-prefix'),
  s3AccessKey: $('#s3-access-key'),
  s3SecretKey: $('#s3-secret-key'),
  supabaseFields: $('#supabase-fields'),
  supabaseProjectRef: $('#supabase-project-ref'),
  supabaseRegion: $('#supabase-region'),
  supabaseBucket: $('#supabase-bucket'),
  supabasePrefix: $('#supabase-prefix'),
  supabaseAccessKey: $('#supabase-access-key'),
  supabaseSecretKey: $('#supabase-secret-key'),
  supabaseSettingsDialog: $('#supabase-settings-dialog'),
  supabaseSettingsClose: $('#supabase-settings-close'),
  supabaseSettingsForm: $('#supabase-settings-form'),
  supabaseSettingsName: $('#supabase-settings-name'),
  supabaseSettingsProjectRef: $('#supabase-settings-project-ref'),
  supabaseSettingsRegion: $('#supabase-settings-region'),
  supabaseSettingsBucket: $('#supabase-settings-bucket'),
  supabaseSettingsPrefix: $('#supabase-settings-prefix'),
  supabaseSettingsAccessKey: $('#supabase-settings-access-key'),
  supabaseSettingsSecretKey: $('#supabase-settings-secret-key'),
  supabaseSettingsError: $('#supabase-settings-error'),
  managedAvatar: $('#managed-avatar'),
  managedName: $('#managed-name'),
  managedEmail: $('#managed-email'),
  managedRole: $('#managed-role'),
  managedQuota: $('#managed-quota'),
  managedSave: $('#managed-save'),
  managedSuspend: $('#managed-suspend'),
  managedDelete: $('#managed-delete'),
  managedUsage: $('#managed-usage'),
  copyrightYear: $('#copyright-year'),
};

elements.createAccount.addEventListener('click', () => openAuth('register'));
elements.heroCreate.addEventListener('click', () => openAuth('register'));
elements.signIn.addEventListener('click', () => openAuth('login'));
elements.heroSignIn.addEventListener('click', () => openAuth('login'));
elements.authSwitch.addEventListener('click', () => setAuthMode(state.authMode === 'register' ? 'login' : 'register'));
elements.authClose.addEventListener('click', () => elements.authDialog.close());
elements.authForm.addEventListener('submit', submitAuth);
elements.signOut.addEventListener('click', signOut);
elements.brand.addEventListener('click', () => state.user ? showDashboard() : showHome());
elements.accountButton.addEventListener('click', (event) => {
  event.stopPropagation();
  elements.accountMenu.hidden = !elements.accountMenu.hidden;
  elements.accountButton.setAttribute('aria-expanded', String(!elements.accountMenu.hidden));
});
document.addEventListener('click', () => {
  elements.accountMenu.hidden = true;
  elements.accountButton.setAttribute('aria-expanded', 'false');
});
elements.adminPanelButton.addEventListener('click', openAdminPanel);
elements.adminExit.addEventListener('click', showDashboard);
elements.adminRefresh.addEventListener('click', loadAdminData);
elements.googleSystemSettingsForm.addEventListener('submit', saveGoogleSystemSettings);
elements.billingSettingsForm.addEventListener('submit', saveBillingSettings);
elements.adminUsersBack.addEventListener('click', showAdminOverview);
elements.managedSave.addEventListener('click', saveManagedUser);
elements.managedSuspend.addEventListener('click', toggleManagedUserStatus);
elements.managedDelete.addEventListener('click', deleteManagedUser);
elements.copyrightYear.textContent = String(new Date().getFullYear());
elements.localStorageTab.addEventListener('click', () => switchStorageView('local'));
elements.connectedStorageTab.addEventListener('click', () => switchStorageView('connections'));
elements.addConnection.addEventListener('click', openConnectionDialog);
elements.emptyAddConnection.addEventListener('click', openConnectionDialog);
elements.connectionClose.addEventListener('click', () => elements.connectionDialog.close());
elements.connectionProvider.addEventListener('change', updateConnectionFields);
elements.connectionForm.addEventListener('submit', submitConnection);
elements.googleSettingsClose.addEventListener('click', () => elements.googleSettingsDialog.close());
elements.googleSettingsForm.addEventListener('submit', saveGoogleSettings);
elements.googleRefreshInfo.addEventListener('click', refreshGoogleInfo);
elements.googleReconnect.addEventListener('click', reconnectGoogleDrive);
elements.supabaseSettingsClose.addEventListener('click', () => elements.supabaseSettingsDialog.close());
elements.supabaseSettingsForm.addEventListener('submit', saveSupabaseSettings);
elements.remoteBack.addEventListener('click', () => switchStorageView('connections'));
elements.remoteFileInput.addEventListener('change', () => uploadRemoteFiles([...elements.remoteFileInput.files]));
elements.remoteNewFolder.addEventListener('click', () => {
  elements.remoteFolderName.value = '';
  elements.remoteFolderDialog.showModal();
  setTimeout(() => elements.remoteFolderName.focus(), 50);
});
elements.remoteFolderForm.addEventListener('submit', createRemoteFolder);

elements.fileInput.addEventListener('change', () => uploadFiles([...elements.fileInput.files]));
elements.folderButton.addEventListener('click', () => {
  elements.folderName.value = '';
  elements.folderDialog.showModal();
  setTimeout(() => elements.folderName.focus(), 50);
});
elements.folderForm.addEventListener('submit', createFolder);
elements.search.addEventListener('input', renderFiles);

for (const eventName of ['dragenter', 'dragover']) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (eventName === 'dragleave' && elements.dropZone.contains(event.relatedTarget)) return;
    elements.dropZone.classList.remove('dragging');
  });
}
elements.dropZone.addEventListener('drop', (event) => uploadFiles([...event.dataTransfer.files]));
for (const eventName of ['dragenter', 'dragover']) {
  elements.remoteDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.remoteDropZone.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  elements.remoteDropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (eventName === 'dragleave' && elements.remoteDropZone.contains(event.relatedTarget)) return;
    elements.remoteDropZone.classList.remove('dragging');
  });
}
elements.remoteDropZone.addEventListener('drop', (event) => uploadRemoteFiles([...event.dataTransfer.files]));

initialize();

async function initialize() {
  const oauthReturn = new URLSearchParams(location.search);
  try {
    const data = await (await api('/api/auth/me')).json();
    state.user = data.user;
    await showDashboard();
  } catch (error) {
    if (error.status === 401) return showHome();
    showHome();
    showToast(error.message);
  } finally {
    const googleResult = oauthReturn.get('google');
    if (googleResult) {
      history.replaceState({}, '', location.pathname);
      if (googleResult === 'connected') showToast('Google Drive connected');
      else if (googleResult === 'denied') showToast('Google Drive connection was cancelled');
      else showToast(oauthReturn.get('message') || 'Google Drive could not be connected');
    }
    const billingResult = oauthReturn.get('billing');
    if (billingResult) {
      history.replaceState({}, '', location.pathname);
      if (billingResult === 'success') {
        const plan = oauthReturn.get('plan');
        showToast(plan ? ('Plan updated to ' + plan) : 'Billing updated');
      } else if (billingResult === 'cancelled') {
        showToast('PayPal checkout was cancelled');
      } else if (billingResult === 'invalid') {
        showToast('That billing session could not be found');
      } else {
        showToast(oauthReturn.get('message') || 'Billing could not be completed');
      }
    }
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).error || message; } catch {}
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response;
}

function showHome() {
  elements.home.hidden = false;
  elements.dashboard.hidden = true;
  elements.adminView.hidden = true;
  elements.guestActions.hidden = false;
  elements.accountActions.hidden = true;
  document.title = 'SavelyCLOUD — Your files, at home';
}

async function showDashboard() {
  if (!state.user) return showHome();
  elements.home.hidden = true;
  elements.dashboard.hidden = false;
  elements.adminView.hidden = true;
  elements.guestActions.hidden = true;
  elements.accountActions.hidden = false;
  elements.accountName.textContent = state.user.name;
  elements.accountEmail.textContent = state.user.email;
  elements.adminPanelButton.hidden = state.user.role !== 'admin';
  elements.folderButton.hidden = false;
  elements.localUploadLabel.hidden = false;
  elements.avatar.textContent = initials(state.user.name);
  elements.welcomeTitle.textContent = `${firstName(state.user.name)}’s files.`;
  document.title = `My files — SavelyCLOUD`;
  switchStorageView('local');
  await Promise.all([loadStatus(), loadFiles(''), loadBillingData()]);
}

function openAuth(mode) {
  setAuthMode(mode);
  elements.authForm.reset();
  elements.authError.hidden = true;
  elements.authDialog.showModal();
  setTimeout(() => (mode === 'register' ? elements.authName : elements.authEmail).focus(), 60);
}

function setAuthMode(mode) {
  state.authMode = mode;
  const registering = mode === 'register';
  elements.authEyebrow.textContent = registering ? 'Start your private cloud' : 'Welcome back';
  elements.authTitle.textContent = registering ? 'Create your account' : 'Sign in to SavelyCLOUD';
  elements.authSubtitle.textContent = registering ? 'A private space for your files, right here.' : 'Your files are right where you left them.';
  elements.authSubmit.textContent = registering ? 'Create account' : 'Sign in';
  elements.authSwitchCopy.textContent = registering ? 'Already have an account?' : 'New to SavelyCLOUD?';
  elements.authSwitch.textContent = registering ? 'Sign in' : 'Create an account';
  elements.authName.closest('label').hidden = !registering;
  elements.authName.required = registering;
  elements.authPlan.closest('label').hidden = !registering;
  elements.authPlan.disabled = !registering;
  elements.authPassword.autocomplete = registering ? 'new-password' : 'current-password';
  elements.authError.hidden = true;
}

async function submitAuth(event) {
  event.preventDefault();
  elements.authError.hidden = true;
  elements.authSubmit.disabled = true;
  elements.authSubmit.textContent = state.authMode === 'register' ? 'Creating account…' : 'Signing in…';
  try {
    const payload = {
      email: elements.authEmail.value,
      password: elements.authPassword.value,
    };
    if (state.authMode === 'register') {
      payload.name = elements.authName.value;
      payload.planId = elements.authPlan.value;
    }
    const data = await (await api(`/api/auth/${state.authMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })).json();
    state.user = data.user;
    elements.authDialog.close();
    await showDashboard();
    showToast(state.authMode === 'register' ? 'Your private cloud is ready' : 'Welcome back');
  } catch (error) {
    elements.authError.textContent = error.message;
    elements.authError.hidden = false;
  } finally {
    elements.authSubmit.disabled = false;
    elements.authSubmit.textContent = state.authMode === 'register' ? 'Create account' : 'Sign in';
  }
}

async function signOut() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    if (error.status !== 401) showToast(error.message);
  }
  state.user = null;
  state.path = '';
  state.items = [];
  elements.accountMenu.hidden = true;
  showHome();
  showToast('Signed out');
}

async function openAdminPanel() {
  if (state.user?.role !== 'admin') return;
  elements.accountMenu.hidden = true;
  elements.home.hidden = true;
  elements.dashboard.hidden = true;
  elements.adminView.hidden = false;
  elements.folderButton.hidden = true;
  elements.localUploadLabel.hidden = true;
  document.title = 'Admin panel — SavelyCLOUD';
  showAdminOverview();
  await loadAdminData();
}

function showAdminOverview() {
  elements.adminOverviewPanel.hidden = false;
  elements.adminUserDetail.hidden = true;
  state.managedUser = null;
}

async function loadAdminData() {
  try {
    const [overview, users, settings, billing] = await Promise.all([
      api('/api/admin/overview').then((response) => response.json()),
      api('/api/admin/users').then((response) => response.json()),
      api('/api/admin/settings').then((response) => response.json()),
      api('/api/admin/billing').then((response) => response.json()),
    ]);
    state.adminUsers = users.users;
    elements.adminUserCount.textContent = String(overview.users);
    elements.adminActiveCount.textContent = `${overview.activeUsers} active`;
    elements.adminFileCount.textContent = String(overview.files);
    elements.adminStorageUsed.textContent = formatBytes(overview.used);
    elements.adminConnectionCount.textContent = String(overview.connections);
    renderGoogleSystemSettings(settings.google);
    renderAdminBillingSettings(billing);
    renderAdminUsers();
  } catch (error) { handleApiError(error); }
}

function renderGoogleSystemSettings(settings) {
  elements.googleSystemClientId.value = settings.clientId || '';
  elements.googleSystemClientSecret.value = '';
  elements.googleSystemRedirectUri.value = settings.redirectUri || '';
  elements.googleSystemSecretStatus.textContent = settings.clientSecretConfigured
    ? 'A secret is configured. Leave this empty to keep it.'
    : 'No secret is configured yet.';
  elements.googleSystemSource.textContent = settings.source === 'dashboard' ? 'Dashboard override' : 'Environment fallback';
}

async function saveGoogleSystemSettings(event) {
  event.preventDefault();
  elements.googleSystemError.hidden = true;
  elements.googleSystemSave.disabled = true;
  elements.googleSystemSave.textContent = 'Saving…';
  try {
    const response = await api('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        google: {
          clientId: elements.googleSystemClientId.value.trim(),
          clientSecret: elements.googleSystemClientSecret.value.trim(),
          redirectUri: elements.googleSystemRedirectUri.value.trim(),
        },
      }),
    });
    const settings = await response.json();
    renderGoogleSystemSettings(settings.google);
    showToast('Google Drive settings saved');
  } catch (error) {
    elements.googleSystemError.textContent = error.message;
    elements.googleSystemError.hidden = false;
  } finally {
    elements.googleSystemSave.disabled = false;
    elements.googleSystemSave.textContent = 'Save Google settings';
  }
}

function renderAdminBillingSettings(billing) {
  state.billingAdmin = billing;
  const paypal = billing.paypal || {};
  const freePlan = billing.plans?.free || {};
  const paidPlan = billing.plans?.paid || {};
  elements.billingPaypalClientId.value = paypal.clientId || '';
  elements.billingPaypalClientSecret.value = '';
  elements.billingPaypalSecretStatus.textContent = paypal.clientSecretConfigured
    ? 'A secret is configured. Leave this empty to keep it.'
    : 'No secret is configured yet.';
  elements.billingSettingsSource.textContent = paypal.source === 'dashboard' ? 'Dashboard override' : 'Environment fallback';
  elements.billingPaypalEnvironment.value = paypal.environment || 'sandbox';
  elements.billingPaypalCurrency.value = paypal.currency || 'USD';
  elements.billingFreeActive.checked = true;
  elements.billingFreeActive.disabled = true;
  elements.billingFreeName.value = freePlan.name || 'Free';
  elements.billingFreeDescription.value = freePlan.description || '';
  elements.billingFreeStorage.value = formatGigabytes(freePlan.storageLimitBytes);
  elements.billingPaidActive.checked = Boolean(paidPlan.active);
  elements.billingPaidName.value = paidPlan.name || 'Pro';
  elements.billingPaidDescription.value = paidPlan.description || '';
  elements.billingPaidPrice.value = formatCurrencyInput(paidPlan.priceCents);
  elements.billingPaidStorage.value = formatGigabytes(paidPlan.storageLimitBytes);
  elements.billingPaidFeatured.checked = Boolean(paidPlan.featured);
  elements.billingSettingsError.hidden = true;
}

async function saveBillingSettings(event) {
  event.preventDefault();
  elements.billingSettingsError.hidden = true;
  elements.billingSettingsSave.disabled = true;
  elements.billingSettingsSave.textContent = 'Saving???';
  try {
    const currency = elements.billingPaypalCurrency.value.trim().toUpperCase();
    const response = await api('/api/admin/billing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paypal: {
          clientId: elements.billingPaypalClientId.value.trim(),
          clientSecret: elements.billingPaypalClientSecret.value.trim(),
          environment: elements.billingPaypalEnvironment.value,
          currency,
        },
        plans: {
          free: {
            name: elements.billingFreeName.value.trim(),
            description: elements.billingFreeDescription.value.trim(),
            active: true,
            featured: false,
            priceCents: 0,
            currency,
            storageLimitBytes: parseGigabytes(elements.billingFreeStorage.value, 'Free plan storage limit'),
          },
          paid: {
            name: elements.billingPaidName.value.trim(),
            description: elements.billingPaidDescription.value.trim(),
            active: elements.billingPaidActive.checked,
            featured: elements.billingPaidFeatured.checked,
            priceCents: parseCurrencyCents(elements.billingPaidPrice.value, 'Paid plan price'),
            currency,
            storageLimitBytes: parseGigabytes(elements.billingPaidStorage.value, 'Paid plan storage limit'),
          },
        },
      }),
    });
    const billing = await response.json();
    renderAdminBillingSettings(billing);
    state.billingAdmin = billing;
    showToast('Billing settings saved');
    await loadBillingData();
  } catch (error) {
    elements.billingSettingsError.textContent = error.message;
    elements.billingSettingsError.hidden = false;
  } finally {
    elements.billingSettingsSave.disabled = false;
    elements.billingSettingsSave.textContent = 'Save billing settings';
  }
}

async function loadBillingData() {
  try {
    const data = await (await api('/api/billing/plans')).json();
    state.billingPlans = data.plans || [];
    state.billingCurrentPlanId = data.currentPlanId || 'free';
    state.billingCurrentPlan = data.currentPlan || null;
    state.billingPaypalConfigured = Boolean(data.paypalConfigured);
    state.billingCurrency = data.currency || 'USD';
    if (state.user) state.user.planId = state.billingCurrentPlanId;
    renderBillingPlans();
  } catch (error) { handleApiError(error); }
}

function renderBillingPlans() {
  const currentPlan = state.billingPlans.find((plan) => plan.id === state.billingCurrentPlanId) || state.billingCurrentPlan || state.billingPlans[0] || null;
  elements.billingCurrentPlan.textContent = currentPlan ? (currentPlan.name + ' plan') : 'Free plan';
  elements.billingPlanList.replaceChildren(...state.billingPlans.map((plan) => {
    const card = document.createElement('article');
    card.className = 'billing-plan-card';
    if (plan.featured) card.classList.add('featured');
    const head = document.createElement('div');
    head.className = 'billing-plan-card-head';
    const titleWrap = document.createElement('div');
    const name = document.createElement('h3');
    name.textContent = plan.name;
    const price = document.createElement('strong');
    price.textContent = plan.priceCents === 0 ? 'Free' : formatMoney(plan.priceCents, plan.currency || state.billingCurrency);
    const subtitle = document.createElement('p');
    subtitle.textContent = plan.description || '';
    titleWrap.append(name, price, subtitle);
    const badge = document.createElement('span');
    badge.className = 'billing-badge';
    badge.textContent = plan.id === state.billingCurrentPlanId ? 'Current plan' : (plan.featured ? 'Featured' : (plan.active ? 'Available' : 'Inactive'));
    head.append(titleWrap, badge);
    const details = document.createElement('ul');
    details.className = 'billing-plan-details';
    details.append(createBillingDetail('Storage', formatBytes(plan.storageLimitBytes)), createBillingDetail('Status', plan.active ? 'Active' : 'Inactive'), createBillingDetail('Plan ID', plan.id));
    const actions = document.createElement('div');
    actions.className = 'billing-plan-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button primary';
    if (!plan.active) {
      button.disabled = true;
      button.textContent = 'Unavailable';
    } else if (plan.id === state.billingCurrentPlanId) {
      button.disabled = true;
      button.textContent = 'Current plan';
    } else if (plan.id === 'free') {
      button.textContent = 'Switch to free';
      button.addEventListener('click', () => chooseBillingPlan(plan.id));
    } else if (!state.billingPaypalConfigured) {
      button.disabled = true;
      button.textContent = 'PayPal not configured';
    } else {
      button.textContent = 'Upgrade with PayPal';
      button.addEventListener('click', () => chooseBillingPlan(plan.id));
    }
    actions.append(button);
    card.append(head, details, actions);
    return card;
  }));
}

async function chooseBillingPlan(planId) {
  const plan = state.billingPlans.find((item) => item.id === planId);
  if (!plan || plan.id === state.billingCurrentPlanId) return;
  if (plan.id === 'free') {
    try {
      const data = await (await api('/api/billing/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })).json();
      state.user = data.user;
      state.billingCurrentPlanId = data.plan.id;
      state.billingCurrentPlan = data.plan;
      await loadStatus();
      renderBillingPlans();
      showToast('Switched to the free plan');
    } catch (error) { handleApiError(error); }
    return;
  }
  if (!state.billingPaypalConfigured) {
    showToast('PayPal is not configured yet');
    return;
  }
  try {
    const data = await (await api('/api/billing/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    })).json();
    location.href = data.approvalUrl;
  } catch (error) { handleApiError(error); }
}

function createBillingDetail(label, value) {
  const item = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = label;
  const span = document.createElement('span');
  span.textContent = value;
  item.append(strong, span);
  return item;
}

function formatCurrencyInput(cents) {
  return Number.isFinite(Number(cents)) ? (Number(cents) / 100).toFixed(Number(cents) % 100 === 0 ? 0 : 2) : '';
}

function formatMoney(cents, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format((Number(cents) || 0) / 100);
}

function formatGigabytes(bytes) {
  const gigabytes = Number(bytes) / 1024 ** 3;
  if (!Number.isFinite(gigabytes) || gigabytes <= 0) return '';
  return Number.isInteger(gigabytes) ? String(gigabytes) : gigabytes.toFixed(1).replace(/\.0$/, '');
}

function parseGigabytes(value, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(label + ' must be greater than zero.');
  return Math.round(amount * 1024 ** 3);
}

function parseCurrencyCents(value, label) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(label + ' must be a valid amount.');
  return Math.round(amount * 100);
}


function renderAdminUsers() {
  elements.adminUserList.replaceChildren(...state.adminUsers.map((user) => {
    const row = document.createElement('div');
    row.className = 'admin-user-row';
    const info = document.createElement('div');
    info.className = 'admin-user-info';
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = initials(user.name);
    const identity = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = user.name;
    const email = document.createElement('small');
    email.textContent = user.email;
    const plan = document.createElement('small');
    plan.textContent = 'Plan: ' + (user.planName || user.planId || 'Free');
    const role = document.createElement('span');
    role.className = `role-pill ${user.role}`;
    role.textContent = user.role;
    identity.append(name, email, plan, role);
    info.append(avatar, identity);
    const usage = document.createElement('div');
    usage.className = 'user-usage';
    const usageCopy = document.createElement('span');
    const amount = document.createElement('span');
    amount.textContent = `${formatBytes(user.used)} of ${formatBytes(user.storageLimit)}`;
    const files = document.createElement('span');
    files.textContent = `${user.files} ${user.files === 1 ? 'file' : 'files'}`;
    usageCopy.append(amount, files);
    const meter = document.createElement('span');
    meter.className = 'mini-meter';
    const fill = document.createElement('i');
    fill.style.width = `${Math.min(100, user.used / user.storageLimit * 100)}%`;
    meter.append(fill);
    usage.append(usageCopy, meter);
    const status = document.createElement('span');
    status.className = `status-pill ${user.status}`;
    status.textContent = user.status;
    const manage = document.createElement('button');
    manage.type = 'button';
    manage.className = 'manage-button';
    manage.textContent = 'Manage';
    manage.addEventListener('click', () => openManagedUser(user));
    row.append(info, usage, status, manage);
    return row;
  }));
}

async function openManagedUser(user) {
  state.managedUser = user;
  state.adminPath = '';
  elements.adminOverviewPanel.hidden = true;
  elements.adminUserDetail.hidden = false;
  elements.managedAvatar.textContent = initials(user.name);
  elements.managedName.textContent = user.name;
  elements.managedEmail.textContent = user.email;
  elements.managedRole.value = user.role;
  elements.managedQuota.value = (user.storageLimit / 1024 ** 3).toFixed(user.storageLimit < 1024 ** 3 ? 3 : 1).replace(/\.0$/, '');
  elements.managedUsage.textContent = `${formatBytes(user.used)} used · ${user.files} ${user.files === 1 ? 'file' : 'files'} · ${user.connections} connected`;
  elements.managedSuspend.textContent = user.status === 'suspended' ? 'Reactivate account' : 'Suspend account';
  const isSelf = user.id === state.user.id;
  elements.managedSuspend.disabled = isSelf;
  elements.managedDelete.disabled = isSelf;
  elements.managedRole.disabled = isSelf;
  await loadAdminFiles('');
}

async function saveManagedUser() {
  if (!state.managedUser) return;
  const quotaGb = Number(elements.managedQuota.value);
  if (!Number.isFinite(quotaGb) || quotaGb <= 0) return showToast('Enter a storage limit greater than zero.');
  try {
    await api(`/api/admin/users/${state.managedUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: elements.managedRole.value, storageLimit: Math.round(quotaGb * 1024 ** 3) }),
    });
    await loadAdminData();
    const updated = state.adminUsers.find((user) => user.id === state.managedUser.id);
    await openManagedUser(updated);
    showToast('User settings saved');
  } catch (error) { handleApiError(error); }
}

async function toggleManagedUserStatus() {
  if (!state.managedUser) return;
  const nextStatus = state.managedUser.status === 'suspended' ? 'active' : 'suspended';
  const verb = nextStatus === 'suspended' ? 'Suspend' : 'Reactivate';
  if (!confirm(`${verb} ${state.managedUser.name}’s account?`)) return;
  try {
    await api(`/api/admin/users/${state.managedUser.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }),
    });
    await loadAdminData();
    const updated = state.adminUsers.find((user) => user.id === state.managedUser.id);
    await openManagedUser(updated);
    showToast(nextStatus === 'suspended' ? 'Account suspended' : 'Account reactivated');
  } catch (error) { handleApiError(error); }
}

async function deleteManagedUser() {
  if (!state.managedUser) return;
  const confirmation = prompt(`This permanently deletes ${state.managedUser.name} and all local files. Type DELETE to continue.`);
  if (confirmation !== 'DELETE') return;
  try {
    await api(`/api/admin/users/${state.managedUser.id}`, { method: 'DELETE' });
    showAdminOverview();
    await loadAdminData();
    showToast('User account and local files deleted');
  } catch (error) { handleApiError(error); }
}

async function loadAdminFiles(nextPath = state.adminPath) {
  if (!state.managedUser) return;
  try {
    const data = await (await api(`/api/admin/users/${state.managedUser.id}/files?path=${encodeURIComponent(nextPath)}`)).json();
    state.adminPath = data.path;
    state.adminItems = data.items;
    renderAdminBreadcrumbs();
    renderAdminFiles();
  } catch (error) { handleApiError(error); }
}

function renderAdminBreadcrumbs() {
  elements.adminBreadcrumbs.replaceChildren();
  const parts = state.adminPath ? state.adminPath.split('/') : [];
  const crumbs = [{ name: `${state.managedUser.name}’s files`, path: '' }];
  parts.forEach((name, index) => crumbs.push({ name, path: parts.slice(0, index + 1).join('/') }));
  crumbs.forEach((crumb, index) => {
    if (index) {
      const divider = document.createElement('i');
      divider.textContent = '/';
      elements.adminBreadcrumbs.append(divider);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = crumb.name;
    button.title = crumb.name;
    button.addEventListener('click', () => loadAdminFiles(crumb.path));
    elements.adminBreadcrumbs.append(button);
  });
}

function renderAdminFiles() {
  elements.adminFileList.replaceChildren(...state.adminItems.map((item) => {
    const row = document.createElement('div');
    row.className = `file-row ${item.type}`;
    const nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.className = 'file-name';
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = item.type === 'folder' ? '▱' : fileGlyph(item.name);
    const title = document.createElement('strong');
    title.textContent = item.name;
    nameButton.append(icon, title);
    nameButton.addEventListener('click', () => item.type === 'folder' ? loadAdminFiles(item.path) : downloadManagedFile(item));
    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = item.type === 'folder' ? '—' : formatBytes(item.size);
    const date = document.createElement('time');
    date.className = 'file-date';
    date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.modified));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'menu-button';
    remove.title = `Delete ${item.name}`;
    remove.setAttribute('aria-label', `Delete ${item.name}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => deleteManagedFile(item));
    row.append(nameButton, size, date, remove);
    return row;
  }));
  elements.adminFilesEmpty.hidden = state.adminItems.length !== 0;
}

async function downloadManagedFile(item) {
  try {
    const response = await api(`/api/admin/users/${state.managedUser.id}/download?path=${encodeURIComponent(item.path)}`);
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = item.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch (error) { handleApiError(error); }
}

async function deleteManagedFile(item) {
  const description = item.type === 'folder' ? 'folder and everything inside it' : 'file';
  if (!confirm(`Permanently delete the ${description} “${item.name}” from ${state.managedUser.name}’s account?`)) return;
  try {
    await api(`/api/admin/users/${state.managedUser.id}/files?path=${encodeURIComponent(item.path)}`, { method: 'DELETE' });
    await loadAdminFiles();
    await loadAdminData();
    showToast('Managed file deleted');
  } catch (error) { handleApiError(error); }
}

function switchStorageView(view) {
  const local = view === 'local';
  const connections = view === 'connections';
  elements.localStoragePanel.hidden = !local;
  elements.connectionsPanel.hidden = !connections;
  elements.remotePanel.hidden = view !== 'remote';
  elements.localStorageTab.classList.toggle('active', local);
  elements.connectedStorageTab.classList.toggle('active', !local);
  if (connections) loadConnections();
}

async function loadConnections() {
  try {
    const data = await (await api('/api/connections')).json();
    state.connections = data.connections;
    renderConnections();
  } catch (error) { handleApiError(error); }
}

function renderConnections() {
  elements.connectionGrid.replaceChildren(...state.connections.map((connection) => {
    const card = document.createElement('article');
    card.className = `connection-card ${connection.provider}`;
    const icon = document.createElement('span');
    icon.className = 'connection-card-icon';
    icon.textContent = connection.provider === 'webdav' ? '◎' : connection.provider === 'google' ? '△' : '▰';
    const copy = document.createElement('span');
    if (connection.provider === 'supabase') icon.textContent = 'S';
    copy.className = 'connection-card-copy';
    const name = document.createElement('strong');
    name.textContent = connection.name;
    const detail = document.createElement('small');
    detail.textContent = connection.provider === 'webdav'
      ? connection.details.baseUrl
      : connection.provider === 'google'
        ? (connection.details.accountEmail || 'Google Drive')
        : `${connection.details.bucket} · ${connection.details.region}`;
    copy.append(name, detail);
    if (connection.provider === 'supabase') detail.textContent = `${connection.details.bucket} · ${connection.details.projectRef}`;
    const actions = document.createElement('span');
    actions.className = 'connection-card-actions';
    const browse = document.createElement('button');
    browse.type = 'button';
    browse.textContent = 'Browse';
    browse.addEventListener('click', () => openRemoteConnection(connection));
    if (connection.provider === 'google') {
      const settings = document.createElement('button');
      settings.type = 'button';
      settings.textContent = 'Settings';
      settings.addEventListener('click', () => openGoogleSettings(connection));
      actions.append(settings);
    }
    if (connection.provider === 'supabase') {
      const settings = document.createElement('button');
      settings.type = 'button';
      settings.textContent = 'Settings';
      settings.addEventListener('click', () => openSupabaseSettings(connection));
      actions.append(settings);
    }
    const unlink = document.createElement('button');
    unlink.type = 'button';
    unlink.className = 'unlink';
    unlink.title = `Unlink ${connection.name}`;
    unlink.setAttribute('aria-label', `Unlink ${connection.name}`);
    unlink.textContent = '×';
    unlink.addEventListener('click', () => unlinkConnection(connection));
    actions.prepend(browse);
    actions.append(unlink);
    card.append(icon, copy, actions);
    return card;
  }));
  elements.connectionsEmpty.hidden = state.connections.length !== 0;
  elements.connectionGrid.hidden = state.connections.length === 0;
}

function openGoogleSettings(connection) {
  state.googleSettingsConnection = connection;
  elements.googleSettingsName.value = connection.name;
  elements.googleSettingsEmail.textContent = connection.details.accountEmail || 'Account information unavailable';
  elements.googleSettingsError.hidden = true;
  elements.googleSettingsDialog.showModal();
  setTimeout(() => elements.googleSettingsName.focus(), 50);
}

async function saveGoogleSettings(event) {
  event.preventDefault();
  const connection = state.googleSettingsConnection;
  if (!connection) return;
  elements.googleSettingsError.hidden = true;
  try {
    const data = await (await api(`/api/connections/${connection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: elements.googleSettingsName.value }),
    })).json();
    state.googleSettingsConnection = data.connection;
    await loadConnections();
    elements.googleSettingsDialog.close();
    showToast('Google Drive settings saved');
  } catch (error) {
    elements.googleSettingsError.textContent = error.message;
    elements.googleSettingsError.hidden = false;
  }
}

async function refreshGoogleInfo() {
  const connection = state.googleSettingsConnection;
  if (!connection) return;
  elements.googleRefreshInfo.disabled = true;
  elements.googleRefreshInfo.textContent = 'Refreshing…';
  elements.googleSettingsError.hidden = true;
  try {
    const data = await (await api(`/api/connections/${connection.id}/google-info`, { method: 'POST' })).json();
    state.googleSettingsConnection = data.connection;
    elements.googleSettingsEmail.textContent = data.connection.details.accountEmail || 'Account information unavailable';
    await loadConnections();
    showToast('Google account information updated');
  } catch (error) {
    elements.googleSettingsError.textContent = error.message;
    elements.googleSettingsError.hidden = false;
  } finally {
    elements.googleRefreshInfo.disabled = false;
    elements.googleRefreshInfo.textContent = 'Refresh account info';
  }
}

async function reconnectGoogleDrive() {
  const connection = state.googleSettingsConnection;
  if (!connection) return;
  elements.googleReconnect.disabled = true;
  elements.googleReconnect.textContent = 'Opening Google…';
  elements.googleSettingsError.hidden = true;
  try {
    const query = new URLSearchParams({ name: elements.googleSettingsName.value, connectionId: connection.id });
    const data = await (await api(`/api/connections/google/start?${query}`)).json();
    location.assign(data.authorizationUrl);
  } catch (error) {
    elements.googleSettingsError.textContent = error.message;
    elements.googleSettingsError.hidden = false;
    elements.googleReconnect.disabled = false;
    elements.googleReconnect.textContent = 'Reconnect account';
  }
}

function openSupabaseSettings(connection) {
  state.supabaseSettingsConnection = connection;
  elements.supabaseSettingsName.value = connection.name;
  elements.supabaseSettingsProjectRef.value = connection.details.projectRef;
  elements.supabaseSettingsRegion.value = connection.details.region;
  elements.supabaseSettingsBucket.value = connection.details.bucket;
  elements.supabaseSettingsPrefix.value = connection.details.prefix || '';
  elements.supabaseSettingsAccessKey.value = '';
  elements.supabaseSettingsSecretKey.value = '';
  elements.supabaseSettingsError.hidden = true;
  elements.supabaseSettingsDialog.showModal();
  setTimeout(() => elements.supabaseSettingsName.focus(), 50);
}

async function saveSupabaseSettings(event) {
  event.preventDefault();
  const connection = state.supabaseSettingsConnection;
  if (!connection) return;
  elements.supabaseSettingsError.hidden = true;
  try {
    await api(`/api/connections/${connection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: elements.supabaseSettingsName.value,
        projectRef: elements.supabaseSettingsProjectRef.value,
        region: elements.supabaseSettingsRegion.value,
        bucket: elements.supabaseSettingsBucket.value,
        prefix: elements.supabaseSettingsPrefix.value,
        accessKeyId: elements.supabaseSettingsAccessKey.value,
        secretAccessKey: elements.supabaseSettingsSecretKey.value,
      }),
    });
    await loadConnections();
    elements.supabaseSettingsDialog.close();
    showToast('Supabase connection updated');
  } catch (error) {
    elements.supabaseSettingsError.textContent = error.message;
    elements.supabaseSettingsError.hidden = false;
  }
}

function openConnectionDialog() {
  elements.connectionForm.reset();
  elements.s3Region.value = 'us-east-1';
  elements.supabaseRegion.value = 'us-east-1';
  elements.connectionError.hidden = true;
  updateConnectionFields();
  elements.connectionDialog.showModal();
  setTimeout(() => elements.connectionName.focus(), 50);
}

function updateConnectionFields() {
  const provider = elements.connectionProvider.value;
  const isWebDav = provider === 'webdav';
  elements.googleFields.hidden = provider !== 'google';
  elements.webDavFields.hidden = !isWebDav;
  elements.s3Fields.hidden = provider !== 's3';
  elements.supabaseFields.hidden = provider !== 'supabase';
}

async function submitConnection(event) {
  event.preventDefault();
  elements.connectionError.hidden = true;
  elements.connectionSubmit.disabled = true;
  elements.connectionSubmit.textContent = 'Testing connection…';
  const provider = elements.connectionProvider.value;
  if (provider === 'google') {
    try {
      const data = await (await api(`/api/connections/google/start?name=${encodeURIComponent(elements.connectionName.value)}`)).json();
      elements.connectionSubmit.textContent = 'Opening Google…';
      location.assign(data.authorizationUrl);
      return;
    } catch (error) {
      elements.connectionError.textContent = error.message;
      elements.connectionError.hidden = false;
      elements.connectionSubmit.disabled = false;
      elements.connectionSubmit.textContent = 'Connect storage';
      return;
    }
  }
  const payload = provider === 'webdav' ? {
    name: elements.connectionName.value,
    provider,
    baseUrl: elements.webDavUrl.value,
    username: elements.webDavUsername.value,
    password: elements.webDavPassword.value,
  } : provider === 'supabase' ? {
    name: elements.connectionName.value,
    provider,
    projectRef: elements.supabaseProjectRef.value,
    region: elements.supabaseRegion.value,
    bucket: elements.supabaseBucket.value,
    prefix: elements.supabasePrefix.value,
    accessKeyId: elements.supabaseAccessKey.value,
    secretAccessKey: elements.supabaseSecretKey.value,
  } : {
    name: elements.connectionName.value,
    provider,
    endpoint: elements.s3Endpoint.value,
    region: elements.s3Region.value,
    bucket: elements.s3Bucket.value,
    prefix: elements.s3Prefix.value,
    accessKeyId: elements.s3AccessKey.value,
    secretAccessKey: elements.s3SecretKey.value,
  };
  try {
    await api('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    elements.connectionDialog.close();
    await loadConnections();
    showToast('Storage connected');
  } catch (error) {
    elements.connectionError.textContent = error.message;
    elements.connectionError.hidden = false;
  } finally {
    elements.connectionSubmit.disabled = false;
    elements.connectionSubmit.textContent = 'Connect storage';
  }
}

async function unlinkConnection(connection) {
  if (!confirm(`Unlink “${connection.name}”? Files in the online service will not be deleted.`)) return;
  try {
    await api(`/api/connections/${connection.id}`, { method: 'DELETE' });
    await loadConnections();
    showToast('Storage unlinked');
  } catch (error) { handleApiError(error); }
}

async function openRemoteConnection(connection) {
  state.currentConnection = connection;
  state.remotePath = '';
  elements.localStoragePanel.hidden = true;
  elements.connectionsPanel.hidden = true;
  elements.remotePanel.hidden = false;
  elements.localStorageTab.classList.remove('active');
  elements.connectedStorageTab.classList.add('active');
  elements.remoteProviderBadge.textContent = connection.provider === 'webdav' ? 'WebDAV' : connection.provider === 'google' ? 'Google Drive' : 'S3 compatible';
  await loadRemoteFiles('');
}

async function loadRemoteFiles(nextPath = state.remotePath) {
  if (!state.currentConnection) return;
  try {
    const data = await (await api(`/api/connections/${state.currentConnection.id}/files?path=${encodeURIComponent(nextPath)}`)).json();
    state.remotePath = data.path;
    state.remoteItems = data.items;
    renderRemoteBreadcrumbs();
    renderRemoteFiles();
  } catch (error) { handleApiError(error); }
}

function renderRemoteBreadcrumbs() {
  elements.remoteBreadcrumbs.replaceChildren();
  const parts = state.remotePath ? state.remotePath.split('/') : [];
  const crumbs = [{ name: state.currentConnection.name, path: '' }];
  parts.forEach((name, index) => crumbs.push({ name, path: parts.slice(0, index + 1).join('/') }));
  crumbs.forEach((crumb, index) => {
    if (index) {
      const divider = document.createElement('i');
      divider.textContent = '/';
      elements.remoteBreadcrumbs.append(divider);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = crumb.name;
    button.title = crumb.name;
    button.addEventListener('click', () => loadRemoteFiles(crumb.path));
    elements.remoteBreadcrumbs.append(button);
  });
}

function renderRemoteFiles() {
  elements.remoteFileList.replaceChildren(...state.remoteItems.map((item) => {
    const row = document.createElement('div');
    row.className = `file-row ${item.type}`;
    const nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.className = 'file-name';
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = item.type === 'folder' ? '▱' : fileGlyph(item.name);
    const title = document.createElement('strong');
    title.textContent = item.name;
    nameButton.append(icon, title);
    nameButton.addEventListener('click', () => item.type === 'folder' ? loadRemoteFiles(item.path) : downloadRemoteFile(item));
    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = item.type === 'folder' ? '—' : formatBytes(item.size || 0);
    const date = document.createElement('time');
    date.className = 'file-date';
    date.textContent = item.modified ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.modified)) : '—';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'menu-button';
    remove.hidden = item.type === 'folder';
    remove.title = `Delete ${item.name} from connected storage`;
    remove.setAttribute('aria-label', `Delete ${item.name} from connected storage`);
    remove.textContent = '×';
    remove.addEventListener('click', () => deleteRemoteFile(item));
    row.append(nameButton, size, date, remove);
    return row;
  }));
  elements.remoteEmpty.hidden = state.remoteItems.length !== 0;
}

async function uploadRemoteFiles(files) {
  if (!files.length || !state.currentConnection) return;
  elements.uploadPanel.hidden = false;
  elements.uploadTitle.textContent = `Sending ${files.length} ${files.length === 1 ? 'file' : 'files'}`;
  let complete = 0;
  try {
    for (const file of files) {
      elements.uploadDetail.textContent = file.name;
      const target = joinPath(state.remotePath, file.name);
      await api(`/api/connections/${state.currentConnection.id}/files?path=${encodeURIComponent(target)}`, {
        method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file,
      });
      complete += 1;
      elements.uploadMeter.style.width = `${complete / files.length * 100}%`;
    }
    await loadRemoteFiles();
    showToast(`${complete} ${complete === 1 ? 'file' : 'files'} sent`);
  } catch (error) { handleApiError(error); }
  finally {
    elements.remoteFileInput.value = '';
    setTimeout(() => { elements.uploadPanel.hidden = true; elements.uploadMeter.style.width = '0'; }, 800);
  }
}

async function createRemoteFolder(event) {
  event.preventDefault();
  const name = elements.remoteFolderName.value.trim();
  if (!name || name === '.' || name === '..' || /[\\/]/.test(name)) return showToast('Use a folder name without slashes.');
  try {
    await api(`/api/connections/${state.currentConnection.id}/folders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: joinPath(state.remotePath, name) }),
    });
    elements.remoteFolderDialog.close();
    await loadRemoteFiles();
    showToast('Remote folder created');
  } catch (error) { handleApiError(error); }
}

async function downloadRemoteFile(item) {
  try {
    const response = await api(`/api/connections/${state.currentConnection.id}/download?path=${encodeURIComponent(item.path)}`);
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = item.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch (error) { handleApiError(error); }
}

async function deleteRemoteFile(item) {
  if (!confirm(`Permanently delete “${item.name}” from ${state.currentConnection.name}?`)) return;
  try {
    await api(`/api/connections/${state.currentConnection.id}/files?path=${encodeURIComponent(item.path)}`, { method: 'DELETE' });
    await loadRemoteFiles();
    showToast('Remote file deleted');
  } catch (error) { handleApiError(error); }
}

async function loadStatus() {
  try {
    const data = await (await api('/api/status')).json();
    const percent = data.limit ? Math.min(100, data.used / data.limit * 100) : 0;
    elements.storagePercent.textContent = `${percent.toFixed(percent < 1 ? 1 : 0)}% used`;
    elements.storageMeter.style.width = `${percent}%`;
    elements.storageCopy.textContent = `${formatBytes(data.used)} of ${formatBytes(data.limit)} · ${formatBytes(data.maxFileSize)} max per file`;
  } catch (error) { handleApiError(error); }
}

async function loadFiles(nextPath = state.path) {
  try {
    const data = await (await api(`/api/files?path=${encodeURIComponent(nextPath)}`)).json();
    state.path = data.path;
    state.items = data.items;
    elements.search.value = '';
    renderBreadcrumbs();
    renderFiles();
  } catch (error) { handleApiError(error); }
}

function renderBreadcrumbs() {
  elements.breadcrumbs.replaceChildren();
  const parts = state.path ? state.path.split('/') : [];
  const crumbs = [{ name: 'My files', path: '' }];
  parts.forEach((name, index) => crumbs.push({ name, path: parts.slice(0, index + 1).join('/') }));
  crumbs.forEach((crumb, index) => {
    if (index) {
      const divider = document.createElement('i');
      divider.textContent = '/';
      elements.breadcrumbs.append(divider);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = crumb.name;
    button.title = crumb.name;
    button.addEventListener('click', () => loadFiles(crumb.path));
    elements.breadcrumbs.append(button);
  });
}

function renderFiles() {
  const query = elements.search.value.trim().toLocaleLowerCase();
  const visible = state.items.filter((item) => item.name.toLocaleLowerCase().includes(query));
  elements.fileList.replaceChildren(...visible.map(createFileRow));
  elements.empty.hidden = visible.length !== 0;
  elements.empty.querySelector('h2').textContent = query ? 'No matching files' : 'This folder is empty';
  elements.empty.querySelector('p').textContent = query ? 'Try a different search in this folder.' : 'Drop files here or use the upload button.';
}

function createFileRow(item) {
  const row = document.createElement('div');
  row.className = `file-row ${item.type}`;
  const nameButton = document.createElement('button');
  nameButton.type = 'button';
  nameButton.className = 'file-name';
  const icon = document.createElement('span');
  icon.className = 'file-icon';
  icon.textContent = item.type === 'folder' ? '▱' : fileGlyph(item.name);
  const title = document.createElement('strong');
  title.textContent = item.name;
  nameButton.append(icon, title);
  nameButton.addEventListener('click', () => item.type === 'folder' ? loadFiles(item.path) : downloadFile(item));
  const size = document.createElement('span');
  size.className = 'file-size';
  size.textContent = item.type === 'folder' ? '—' : formatBytes(item.size);
  const date = document.createElement('time');
  date.className = 'file-date';
  date.dateTime = item.modified;
  date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.modified));
  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'menu-button';
  menu.title = `Delete ${item.name}`;
  menu.setAttribute('aria-label', `Delete ${item.name}`);
  menu.textContent = '×';
  menu.addEventListener('click', () => deleteItem(item));
  row.append(nameButton, size, date, menu);
  return row;
}

async function uploadFiles(files) {
  if (!files.length || !state.user) return;
  elements.uploadPanel.hidden = false;
  elements.uploadTitle.textContent = `Uploading ${files.length} ${files.length === 1 ? 'file' : 'files'}`;
  let complete = 0;
  try {
    for (const file of files) {
      elements.uploadDetail.textContent = file.name;
      const target = joinPath(state.path, file.name);
      let overwrite = false;
      const existing = state.items.find((item) => item.name === file.name);
      if (existing) {
        if (existing.type === 'folder' || !confirm(`${file.name} already exists. Replace it?`)) continue;
        overwrite = true;
      }
      await api(`/api/files?path=${encodeURIComponent(target)}&overwrite=${overwrite}`, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      complete += 1;
      elements.uploadMeter.style.width = `${complete / files.length * 100}%`;
    }
    await Promise.all([loadFiles(), loadStatus()]);
    showToast(`${complete} ${complete === 1 ? 'file' : 'files'} uploaded`);
  } catch (error) { handleApiError(error); }
  finally {
    elements.fileInput.value = '';
    setTimeout(() => {
      elements.uploadPanel.hidden = true;
      elements.uploadMeter.style.width = '0';
    }, 800);
  }
}

async function createFolder(event) {
  event.preventDefault();
  const name = elements.folderName.value.trim();
  if (!name || name === '.' || name === '..' || /[\\/]/.test(name)) return showToast('Use a folder name without slashes.');
  try {
    await api('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: joinPath(state.path, name) }),
    });
    elements.folderDialog.close();
    await loadFiles();
    showToast('Folder created');
  } catch (error) { handleApiError(error); }
}

async function deleteItem(item) {
  const description = item.type === 'folder' ? 'folder and everything inside it' : 'file';
  if (!confirm(`Permanently delete the ${description} “${item.name}”?`)) return;
  try {
    await api(`/api/items?path=${encodeURIComponent(item.path)}`, { method: 'DELETE' });
    await Promise.all([loadFiles(), loadStatus()]);
    showToast(`${item.name} deleted`);
  } catch (error) { handleApiError(error); }
}

async function downloadFile(item) {
  try {
    const response = await api(`/api/download?path=${encodeURIComponent(item.path)}`);
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = item.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch (error) { handleApiError(error); }
}

function handleApiError(error) {
  if (error.status === 401) {
    state.user = null;
    showHome();
    showToast('Your session ended. Please sign in again.');
    return;
  }
  if (error.status === 403 && /suspended/i.test(error.message)) {
    state.user = null;
    showHome();
    showToast(error.message);
    return;
  }
  showToast(error.message || 'Something went wrong.');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { elements.toast.hidden = true; }, 3300);
}

function joinPath(parent, child) { return [parent, child].filter(Boolean).join('/'); }
function firstName(name) { return name.trim().split(/\s+/)[0]; }
function initials(name) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function fileGlyph(name) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return '◩';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(extension)) return '▷';
  if (['mp3', 'wav', 'flac', 'm4a'].includes(extension)) return '♫';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return '▦';
  return '◇';
}
