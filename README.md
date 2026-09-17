# TaskHub UI

A minimal, subtle frontend for the [TaskHub API](../task-api). React + TypeScript +
Vite, no UI framework — a hand-rolled design system in `src/index.css`
(neutral off-white surfaces, a single muted indigo accent, no shadows or
gradients).

Talks to the API over CORS as a separate origin, per its own `VITE_API_URL`.

---

## Setup

Requires Node and a running TaskHub API (see `../task-api/README.md`).

```bash
npm install
cp .env.example .env   # only needed if the API isn't at http://127.0.0.1:8000
npm run dev
```

Opens at http://localhost:5173. The backend must allow this origin in its
CORS config — `task-api/main.py` already whitelists `http://localhost:5173`.

## Structure

```
src/
├── api.ts                    Typed fetch wrapper for every backend endpoint
├── AuthContext.tsx            Token/username state, persisted to localStorage
├── components/
│   ├── ProtectedRoute.tsx     Redirects to /login when there's no token
│   └── TaskRow.tsx            One task: checkbox, inline edit, delete
├── pages/
│   ├── Login.tsx
│   ├── Register.tsx           Registers, then logs in immediately (register
│   │                          doesn't return a token)
│   └── Tasks.tsx               List + quick-add; owns all task state
├── App.tsx                     Routes
└── index.css                   The entire design system
```

## Notes

- The JWT is kept in `localStorage`, so a refresh stays signed in. There's no
  refresh flow — when the token expires (30 min by default), API calls start
  returning 401 and the user has to sign in again.
- `PUT` requests only send fields the user actually changed (`TaskInput`'s
  optional fields are simply omitted from the JSON body), matching the
  backend's `exclude_unset` partial-update contract. Clearing a description
  sends an explicit `null`.
- Toggling a task's checkbox updates optimistically and rolls back on
  failure; create/edit/delete wait for the server response.
