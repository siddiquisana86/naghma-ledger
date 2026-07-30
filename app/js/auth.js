import { CONFIG } from './config.js';

let tokenClient = null;
let accessToken = null;
let currentEmail = null;
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
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    callback: async (resp) => {
      if (resp.error) {
        console.error('Sign-in failed', resp);
        return;
      }
      accessToken = resp.access_token;
      await fetchProfile();
      onSignedIn && onSignedIn();
    },
  });
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
  onSignedOut && onSignedOut();
}

async function fetchProfile() {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    currentEmail = data.email || null;
  } catch (e) {
    currentEmail = null;
  }
}
