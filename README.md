# Ledger

Personal finance tracker: **Next.js + TypeScript**, with money stored in a local **SQLite** file.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database file is created at `data/finance.db` the first time you load the app. It is gitignored so your transactions stay on your machine.

## Stack

- Next.js (App Router) and TypeScript
- SQLite via `better-sqlite3`
- Tailwind CSS

PWA / Home Screen install comes after the core tracker is solid.
