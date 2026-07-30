import { CONFIG } from './config.js';

const SESSION_KEY = 'naghmaLedgerAuth';

let tokenClient = null;
let accessToken = null;
let currentEmail = null;
let currentName = null;
let mockSignedIn = false;

export function isSignedIn() {
  return CONFIG.USE_MOCK_DATA ? mockSignedIn : !!accessToken;
}

export function getAccessToken() {
  return CONFIG.USE_MOCK_DATA ? 'mock-token' : accessToken;
}

export function getEmail() {
  if (CONFIG.USE_MOCK_DATA) return mockSignedIn ? 'demo@example.com (mock)' : null;
  return currentEmail;
}

// Falls back to email if the profile scope hasn't been granted yet (e.g. a
// session saved before this was added) or a Google account has no name set.
export function getName() {
  if (CONFIG.USE_MOCK_DATA) return mockSignedIn ? 'Demo User' : null;
  return currentName || currentEmail;
}

// The access token itself lives only in memory (as before), but is mirrored
// into sessionStorage so a page reload doesn't force a fresh sign-in - it's
// short-lived (~1hr, enforced by Google) and scoped no wider than what the
// in-memory token already grants, so persisting it for the tab's lifetime
// doesn't change the app's security posture.
function saveSession(expiresIn) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    accessToken, email: currentEmail, name: currentName, expiresAt: Date.now() + expiresIn * 1000,
  }));
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.accessToken || session.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

// Google Identity Services must already be loaded (see index.html's
// accounts.google.com/gsi/client script tag) before this runs. No-op in
// mock mode, where sign-in/out just flips local state (see signIn/signOut).
export function initAuth({ onSignedIn }) {
  if (CONFIG.USE_MOCK_DATA) return;
  if (!window.google || !window.google.accounts) {
    console.warn('Google Identity Services not loaded yet');
    return;
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    callback: async (resp) => {
      if (resp.error) {
        console.error('Sign-in failed', resp);
        return;
      }
      accessToken = resp.access_token;
      await fetchProfile();
      saveSession(resp.expires_in);
      onSignedIn && onSignedIn();
    },
  });

  const session = loadSession();
  if (session) {
    accessToken = session.accessToken;
    currentEmail = session.email;
    currentName = session.name || null;
    onSignedIn && onSignedIn();
  }
}

export function signIn(onDone) {
  if (CONFIG.USE_MOCK_DATA) {
    mockSignedIn = true;
    onDone && onDone();
    return;
  }
  if (!tokenClient) {
    console.warn('Auth not initialized yet');
    return;
  }
  tokenClient.requestAccessToken({ prompt: '' });
}

export function signOut(onSignedOut) {
  if (CONFIG.USE_MOCK_DATA) {
    mockSignedIn = false;
    onSignedOut && onSignedOut();
    return;
  }
  if (accessToken && window.google) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  currentEmail = null;
  currentName = null;
  sessionStorage.removeItem(SESSION_KEY);
  onSignedOut && onSignedOut();
}

async function fetchProfile() {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    currentEmail = data.email || null;
    currentName = data.name || null;
  } catch (e) {
    currentEmail = null;
    currentName = null;
  }
}
