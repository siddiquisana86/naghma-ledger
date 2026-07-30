# Naghma's Ledger

A small, static web app for tracking tuition earnings and expenses for
Naghma. It replaces a manually-formatted Google Sheet with a simple,
mobile-friendly UI, while keeping the Google Sheet itself as the source of
truth — there's no backend or database, the app talks to the Sheets API
directly from the browser.

Live site: **https://siddiquisana86.github.io/naghma-ledger/**

## Features

- **Balance at a glance** — current running balance, updated live as
  entries are added.
- **Add, edit, and delete entries** — record money received from a
  student, money spent for Naghma, or money transferred to her, with a
  simple form. Any signed-in account can edit or delete a past entry too.
- **Read-only view for Naghma** — no sign-in required to see the ledger
  and balance; only adding/editing/deleting requires signing in with
  Google.
- **Account balance card** — a separate, sign-in-only figure for Sana's
  own reconciliation, editable from the balance card.
- **Light/dark theme**, works offline for reading (no offline writes).

## Who can do what

- Anyone with the site link can view the ledger and current balance.
- Sana and Zaib can sign in with Google to add, edit, or delete entries,
  and to view/update the account balance figure. Access is controlled by
  the underlying Google Sheet's own sharing permissions, not by the app.

## Setup

See [`SETUP.md`](SETUP.md) for the full checklist to configure Google
Cloud credentials, sheet sharing, and GitHub Pages deployment.

To run locally:

```
npx http-server . -p 8080 -c-1
```

then open `http://localhost:8080`.

## For developers

See [`CLAUDE.md`](CLAUDE.md) for architecture notes and the reasoning
behind a few non-obvious design decisions in this codebase.
