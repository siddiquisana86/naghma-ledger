# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-backend web app (repo root — deployed via GitHub Pages) that replaces a manually-formatted Google
Sheet used to track tuition earnings for a family member. Google Sheets stays
the durable source of truth; the app reads/writes it directly from the
browser via the Sheets API v4 (no server, no database). See `SETUP.md` for
the (partially manual, Google Console-driven) deployment checklist.

The Ledger tab was originally populated by a one-time migration from a much
messier legacy spreadsheet; that migration tooling and the source data are
not part of this repo (they contained real financial records and were a
one-shot ETL, not ongoing infrastructure). From here on, all entries are
added directly through the app or the Sheet itself.

## Commands

- `npx http-server . -p 8080 -c-1` — serve the app locally for manual
  testing (open `http://localhost:8080`). The `-c-1` disables caching —
  without it, edited `js/*.js` files can keep being served stale from
  the browser's HTTP cache across reloads, which looks exactly like a fix
  "not working." There is no build step, bundler, or test suite — this is
  plain HTML/CSS/JS loaded as native ES modules; verify changes by running
  the app in a browser.

## Architecture

### Module layering

- `js/config.js` — the only place holding `SPREADSHEET_ID`, `API_KEY`,
  `CLIENT_ID`, and the `USE_MOCK_DATA` flag. These credentials are meant to
  be public in client-side code; real access control lives in the Sheet's
  own sharing permissions, not in these values.
- `js/sheetsApi.js` — thin wrapper over the Sheets API operations the app
  needs: `readRange` (API key, no auth — used for the no-login read-only
  view), `appendRow` and `updateRange` (both require an OAuth access
  token), `batchUpdate` (structural ops like row deletion — also OAuth),
  and `getSheetId` (looks up a tab's numeric `sheetId` by title, needed
  because `batchUpdate` addresses sheets by numeric id, not tab name).
- `js/auth.js` — wraps Google Identity Services (`google.accounts.oauth2`
  token client, scope `.../auth/spreadsheets`). Every exported function
  branches on `CONFIG.USE_MOCK_DATA` first and short-circuits to local mock
  state, so the whole auth flow can be exercised with zero real credentials.
- `js/ledger.js` — the data layer between the API and the UI: `loadLedger`,
  `addEntry`, `updateEntry`, `deleteEntry`, `addStudent`,
  `loadAccountSummary`, `updateOverallBalance`. Same mock-mode branch
  pattern as `auth.js`. Row shape read from the sheet: `Date | Type |
  Student/Source | Amount In | Amount Out | Notes | Balance`, plus a `row`
  field (the entry's 1-based sheet row number, since `LEDGER_RANGE` starts
  at row 2) used to target `updateEntry`/`deleteEntry` at the right row.
  See below for how `Balance` gets written on each new entry, and for why
  edit/delete don't need to touch it.
- `js/main.js` — DOM wiring and rendering only; imports from the three
  modules above and holds no Sheets-API or auth logic itself.
- `js/mockData.js` — fake placeholder data for `USE_MOCK_DATA: true`. Never
  put real ledger data here — this file ships as part of the public static
  site.
- `js/theme.js` — manual light/dark toggle layered on top of
  `prefers-color-scheme`, persisted in `localStorage`.

**When `USE_MOCK_DATA` is `true`** (the current default), every write in
`ledger.js`/`auth.js` mutates in-memory mock objects instead of calling the
network. Any new read/write path added to `ledger.js` must follow this same
pattern — an early mock-mode branch, not a separate mock implementation
elsewhere.

### Why `addEntry` writes the Balance formula itself, per row, after appending

`addEntry` in `ledger.js` appends the new row's `A:F` values, reads back
which row the Sheets API actually used (`updates.updatedRange` in the
response), then writes that exact row's `Balance` formula
(`=SUM($D$2:D{row})-SUM($E$2:E{row})`) into column G with a follow-up
`updateRange` call.

This two-step dance exists because of a real bug: Google Sheets'
`values.append` picks its insert row by scanning for the first row that's
blank across the *entire* row — not just the columns you're writing to. An
earlier version of this Sheet had the Balance formula pre-filled thousands
of rows ahead of the real data (to spare the app any formula-writing logic).
That backfired badly: since column G was never blank in that pre-filled
range, every append skipped straight past all of it and landed after the
last pre-filled row, nowhere near the real data — silently breaking the
running balance. Don't reintroduce a pre-filled buffer; the row-parse-then-
write approach here is the fix.

### Why `updateEntry`/`deleteEntry` don't need to rewrite Balance formulas

Each row's Balance formula is row-relative and self-contained — it only
reads its own row's `D`/`E` cells (plus the fixed `$2` anchor). `updateEntry`
only overwrites `A{row}:F{row}`, so the formula in `G{row}` never needs to
change. `deleteEntry` removes the row entirely via `batchUpdate`'s
`deleteDimension` (the same effect as deleting a row by hand in the Sheets
UI) rather than blanking its cells — Google Sheets auto-adjusts every later
row's formula references when rows shift up this way, so nothing downstream
needs to be rewritten either. Blanking instead of deleting would leave a
row blank across every column, which is exactly the condition that made
`values.append` skip past the old pre-filled buffer (previous section) —
so a blanked "deleted" row could get silently reused by a future append.

### The `[hidden]` attribute in `styles.css`

Elements toggled via the HTML `hidden` attribute (dialogs, conditional form
sections, toasts) must not also have an unconditional `display:
flex/block/grid` rule on the same selector, since author CSS overrides the
`hidden` attribute's default `display: none`. Any new element toggled via
`.hidden = true/false` in `main.js` needs a matching
`.selector[hidden] { display: none; }` rule in `styles.css`.

### Sort/filter/search in the transaction list is display-only

`renderTxList()`'s search box, Filters dialog (type/student/custom date
range), and Sort dropdown only change which of `ledgerData.rows` get
rendered and in what order — they never write anything back to the Sheet
or touch a row's `balance`, which stays whatever was computed from its
actual position in the Sheet. Sorting by amount or grouping by type is
purely a client-side re-arrangement for display.

### Editable "Summary" fields are row-discovered by label, not by fixed row number

`loadAccountSummary` in `ledger.js` finds the "Overall Account Balance" /
"Balance Last Updated" / "Sana's Share" rows in the `Summary` tab by matching
the label in column A (case-insensitive), then returns the discovered row
numbers so `updateOverallBalance` writes back to the right cells even if the
tab's rows get reordered later. Don't hardcode row numbers for these fields.

## Scope notes (deliberate, not gaps)

- Editing/deleting a ledger entry from the app is unrestricted — any
  signed-in account can edit or delete any row, old or new. This isn't a new
  capability: both authorized accounts already have full Editor access to
  the underlying Sheet and could already do this by hand; the app just adds
  a friendlier UI for it. There's no extra confirmation step beyond the
  in-app delete-confirm dialog, and no undo — Google Sheets' own version
  history is the safety net.
- No offline write queue — adding, editing, or deleting an entry all
  require connectivity.
- The read-only view has no login; it depends on the Sheet being shared
  "Anyone with the link: Viewer". The account-balance UI is hidden behind
  sign-in state as a UI-level-only precaution, not a real access boundary —
  the underlying cell is still readable by anyone with the link.
