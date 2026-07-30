import { CONFIG } from './config.js';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Read-only, no sign-in required - works for everyone because the Sheet is
// shared as "Anyone with the link: Viewer" (see SETUP.md). Real edit access
// control lives in the Sheet's own permissions, not in this key.
export async function readRange(range) {
  const url = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}` +
    `?key=${CONFIG.API_KEY}&valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets read failed: ${res.status}`);
  const data = await res.json();
  return data.values || [];
}

// Requires a Sheets-scoped OAuth access token (see auth.js). Fails cleanly
// with the Sheet's own 403 if the signed-in account only has Viewer access -
// the app does not try to second-guess permissions itself.
export async function appendRow(range, values, accessToken) {
  const url = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append` +
    `?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets append failed (${res.status}): ${body}`);
  }
  return res.json();
}

// Overwrites a specific cell/range (e.g. a single settings-style value),
// as opposed to appendRow's add-a-new-row semantics. Same auth/permission
// behavior as appendRow.
export async function updateRange(range, values, accessToken) {
  const url = `${BASE}/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}` +
    `?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets update failed (${res.status}): ${body}`);
  }
  return res.json();
}

// Structural operations (deleting/moving rows or columns) that values.*
// endpoints can't do - used for row deletion. Same auth/permission behavior
// as appendRow/updateRange.
export async function batchUpdate(requests, accessToken) {
  const url = `${BASE}/${CONFIG.SPREADSHEET_ID}:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets batchUpdate failed (${res.status}): ${body}`);
  }
  return res.json();
}

// Reads the Ledger tab's numeric sheetId, needed for batchUpdate's
// deleteDimension (which addresses sheets by numeric id, not tab name).
// No auth required - same public-read access as readRange.
export async function getSheetId(sheetTitle) {
  const url = `${BASE}/${CONFIG.SPREADSHEET_ID}` +
    `?key=${CONFIG.API_KEY}&fields=sheets.properties(sheetId,title)`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets metadata read failed: ${res.status}`);
  const data = await res.json();
  const sheet = (data.sheets || []).find(s => s.properties.title === sheetTitle);
  return sheet ? sheet.properties.sheetId : null;
}
