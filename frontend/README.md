# SPMS Frontend

React + Vite frontend for the Software Personnel Management System backend.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

The dev server runs on **http://localhost:5173** by default — matching the backend's `CLIENT_ORIGIN` CORS default.

If your backend runs elsewhere, set `VITE_API_BASE_URL` in a `.env` file:

```
VITE_API_BASE_URL=http://localhost:5000/api
```

## Architecture notes

- **API client** (`src/api/client.js`) implements automatic access-token refresh with a single-flight refresh queue. Refresh tokens are single-use + rotating, so the client never reuses a token and never fires concurrent refreshes.
- **Auth state** lives in `AuthContext` and is persisted to localStorage (`spms_access_token`, `spms_refresh_token`, `spms_user`).
- **Route guards** in `src/App.jsx` protect pages by role (`employee`, `supervisor`, `hr_admin`), mirroring backend enforcement.
- **RLS caveat**: the backend scopes every query per-role via PostgreSQL Row-Level Security. A `404` may mean "hidden by RLS" rather than "doesn't exist" — pages surface the API error message verbatim so this is clear.
- There is **no `GET /auth/me`** — the logged-in user snapshot is stored after login and refreshed on token refresh.