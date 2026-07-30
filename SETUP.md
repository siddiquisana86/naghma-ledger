# Setup Guide

Follow these steps in order. Steps 1-6 need to happen before the app works
against your real data; step 7 covers pushing to GitHub and deploying via
GitHub Pages.

## 1. Create a Google Cloud project and enable the Sheets API

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a new project (any name, e.g. "Naghma Ledger").
2. In the search bar, find **Google Sheets API** and click **Enable**.

## 2. Create an OAuth 2.0 Client ID (for Sana and your sign-in)

1. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. If prompted, configure the **OAuth consent screen** first: choose **External**, fill in an app name (e.g. "Naghma Ledger") and your email, and add both your and Sana's Google accounts as **test users** (this keeps the app private while it's in "Testing" mode, which is fine indefinitely for a 2-person tool).
3. Application type: **Web application**.
4. Under **Authorized JavaScript origins**, add:
   - `http://localhost:8080` (or whatever port you use for local testing)
   - later, once deployed, your GitHub Pages URL (e.g. `https://yourusername.github.io`) — you can add this now as a placeholder and edit it after deploying.
5. Save, then copy the generated **Client ID** (ends in `.apps.googleusercontent.com`).

## 3. Create a restricted API key (for Naghma's no-login read-only view)

1. Go to **APIs & Services > Credentials > Create Credentials > API key**.
2. Click **Restrict key**:
   - **API restrictions**: select **Google Sheets API** only.
   - **Application restrictions**: choose **HTTP referrers**, and add your GitHub Pages URL (and `http://localhost:8080/*` for local testing).
3. Copy the API key.

## 4. Set sharing permissions on the real Google Sheet

Open the actual "Naghma 2026" Google Sheet (not the local xlsx copy) and set:
- **Editor** access for Sana's Google account and yours.
- **Share > General access > Anyone with the link > Viewer** — this is what lets the no-login read-only view work for Naghma. See the "Privacy trade-off" note below.

## 5. Import the cleaned data

Already done for the current Sheet — the `Ledger`, `Students`, `Summary`, and `2026 Archive` tabs were populated from a one-time migration off the old messy spreadsheet. That migration script and its source/output files aren't kept in this repo since they contained real financial data; the real Google Sheet is the durable copy now.

Note the **Spreadsheet ID** from the Sheet's URL: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.

## 6. Configure the app

Edit `js/config.js`:

```js
export const CONFIG = {
  SPREADSHEET_ID: '...',   // from step 5
  API_KEY: '...',          // from step 3
  CLIENT_ID: '...',        // from step 2
  USE_MOCK_DATA: false,    // flip to false once the above are filled in
};
```

To test locally before deploying: from the project root, run a static file server with caching disabled - **`npx http-server . -p 8080 -c-1`** (the `-c-1` matters: `http-server`'s default 1-hour cache header means the browser can keep serving an old cached `js/*.js` file after you edit it, even across page reloads, which looks like your change "isn't working"). Then open `http://localhost:8080`. Sign in with either your or Sana's Google account (must be a test user from step 2.2) and confirm entries save correctly to the real Sheet.

## 7. git, GitHub, and Pages

1. `git init`, commit, and push to a GitHub repo.
2. **The repo needs to be public for GitHub Pages to work**, unless the GitHub account is on a paid plan (Pro/Team/Enterprise) — Pages from a private repo isn't available on the free plan. This is fine: `config.js`'s Client ID and restricted API key are meant to be public in client-side code (see its comment); the real access boundary is the Google Sheet's own sharing settings, not repo secrecy.
3. In the repo's **Settings > Pages**, set the source to deploy from branch `main`, folder `/` (root) — GitHub Pages' branch-deployment mode only supports `/` or `/docs`, not an arbitrary subfolder, which is why the app's files live at the repo root rather than under an `app/` folder.
4. Once you have the live `https://<username>.github.io/...` URL, go back to Google Cloud Console and:
   - Add it to the OAuth Client's **Authorized JavaScript origins** (step 2.4).
   - Add it to the restricted API key's **HTTP referrers** (step 3.2).

## Notes

- **Privacy trade-off**: "Anyone with the link: Viewer" means anyone who obtains the Sheet's link (or the app's URL, since the read-only view uses this same public access) can see tuition amounts, student first names, and expense descriptions. No bank account numbers or other sensitive identifiers are stored in the sheet. If that link ever needs to be revoked, change the Sheet's sharing setting back to restricted access.
- **No offline support for writes**: adding an entry requires an internet connection. There's no queueing/retry for offline submissions in this version.
- **Sana's account balance**: the Summary tab includes "Overall Account Balance", "Balance Last Updated", and "Sana's Share" rows (Sana's own personal balance-share calc, unrelated to Naghma's ledger). This is only shown in the app's balance card when signed in — the same "anyone with the link" caveat above still technically applies to the raw data, but it's hidden from the default no-login view. Editable directly from the balance card via the pencil icon.
- **Editing/deleting past entries**: not available in the app for now — make corrections directly in the Google Sheet (Sana already knows how to do this), which is why `Amount In`/`Amount Out`/`Balance` all stay live formulas rather than static numbers.
