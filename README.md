# VerseBloom

VerseBloom is now a local full-stack poetry community app with:

- SQLite-backed storage for users, poems, likes, comments, shares, and sessions
- Email-based login and registration
- Password hashing with PBKDF2
- Token-authenticated REST API
- Static frontend served by the backend or usable from `file://` against the API
- A Vercel-ready deployment path using `vercel.json` and a Postgres-backed serverless API in `api/index.mjs`

## Run locally

1. Double-click `start_server.bat`
2. Open `http://127.0.0.1:8000`

You can also keep `index.html` open from `file://`, but the backend still needs to be running.

In this environment, the SQLite file is created at `%TEMP%\VerseBloom\versebloom.db`.

## Vercel deployment

This repo now includes:

- `vercel.json` for routing `/api/*` requests to a bundled serverless function
- `api/index.mjs` for the Vercel backend
- `package.json` with the `pg` dependency for Postgres

Important: Vercel does not support SQLite as durable serverless storage, so the deployed backend should use Postgres.

### Required Vercel environment variable

- `DATABASE_URL`

The easiest setup is to add a Postgres provider from the Vercel Marketplace and then map its connection string into `DATABASE_URL` if the provider uses a different default variable name.

### Deployment behavior

- Local development can keep using `start_server.bat` and `server.py`
- Vercel deployment uses the frontend files plus `api/index.mjs`
- The frontend already defaults to same-origin `/api` calls on deployed HTTP(S) environments, so it connects automatically after deployment

## Demo accounts

- `aanya@versebloom.local` / `verse123`
- `mateo@versebloom.local` / `verse123`
- `leela@versebloom.local` / `verse123`

## API routes

- `GET /api/health`
- `GET /api/bootstrap`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/poems`
- `POST /api/poems/:id/like`
- `POST /api/poems/:id/comments`
- `POST /api/poems/:id/shares`
