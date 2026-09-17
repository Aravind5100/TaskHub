# TaskHub

A personal task manager API built with FastAPI, SQLAlchemy, and JWT authentication.

Users register an account, log in to receive a bearer token, and manage their own
tasks. Every task belongs to exactly one user, and no endpoint will return or
modify a task belonging to somebody else.

- **Stack:** FastAPI 0.141, SQLAlchemy 2.0, Pydantic 2.13, PostgreSQL, JWT (HS256)
- **Python:** 3.14
- **Interactive docs:** http://127.0.0.1:8000/docs once running

---

## Contents

- [Setup](#setup)
- [Configuration](#configuration)
- [Running](#running)
- [Authentication](#authentication)
- [API reference](#api-reference)
- [Validation rules](#validation-rules)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Design decisions](#design-decisions)
- [Known limitations](#known-limitations)

---

## Setup

Requires Python 3.14 and a running PostgreSQL server.

```bash
# 1. Create and activate a virtualenv
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create the database
createdb task_manager_db

# 4. Create your local config
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"   # paste into SECRET_KEY
```

Tables are created automatically on first import, so there is no separate
migration step yet (see [Known limitations](#known-limitations)).

---

## Configuration

All configuration is read from environment variables, loaded from `.env` at
startup. `config.py` is the single place this happens.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SECRET_KEY` | yes | — | Signs and verifies JWTs |
| `DATABASE_URL` | yes | — | SQLAlchemy connection string |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | `30` | Token lifetime |

The app **refuses to start** if `SECRET_KEY` or `DATABASE_URL` is missing *or
empty*, rather than falling back to a default:

```
RuntimeError: SECRET_KEY is not set. Copy .env.example to .env and fill in a value.
```

This is deliberate. A fallback default is the mechanism by which a development
secret reaches production unnoticed, so misconfiguration fails loudly at import.

`ALGORITHM` is intentionally **not** configurable via the environment — it is a
constant in `config.py`. Making it deploy-configurable invites a weak algorithm
being set by accident.

> `.env` contains a real signing key and is listed in `.gitignore`. Never commit
> it. If the key is ever exposed, replace it — doing so invalidates all existing
> tokens, and users simply log in again. Stored password hashes are unaffected,
> because bcrypt does not depend on `SECRET_KEY`.

---

## Running

```bash
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json

---

## Authentication

TaskHub uses the OAuth2 password flow with bearer JWTs.

1. `POST /users/` to register.
2. `POST /login` with **form-encoded** credentials to get a token.
3. Send `Authorization: Bearer <token>` on every `/tasks/` request.

Tokens are HS256-signed and carry three claims: `sub` (the username), `iat`, and
`exp`. They expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (30 by default). There is
no refresh token and no revocation list, so a token is valid until it expires.

Note that `/login` takes `application/x-www-form-urlencoded`, **not** JSON —
this is what the OAuth2 spec requires and what Swagger UI's Authorize button
sends. Posting JSON to it returns `422`.

```bash
# Register
curl -X POST http://127.0.0.1:8000/users/ \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "correcthorsebattery"}'

# Log in (form-encoded)
curl -X POST http://127.0.0.1:8000/login \
  -d "username=alice&password=correcthorsebattery"
# => {"access_token": "eyJ...", "token_type": "bearer"}

# Use the token
TOKEN="eyJ..."
curl http://127.0.0.1:8000/tasks/ -H "Authorization: Bearer $TOKEN"
```

---

## API reference

Endpoints under `/tasks/` require authentication. `/users/` and `/login` are public.

### `POST /users/` — register

Public. Body:

```json
{ "username": "alice", "password": "correcthorsebattery" }
```

Returns `200` with the new user. The password hash is never included in any
response.

```json
{ "id": 1, "username": "alice" }
```

| Status | Meaning |
|---|---|
| `200` | Created |
| `409` | Username already registered |
| `422` | Validation failed (see [Validation rules](#validation-rules)) |

### `POST /login` — obtain a token

Public. Body is **form-encoded**: `username`, `password`.

```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

| Status | Meaning |
|---|---|
| `200` | Token issued |
| `401` | Incorrect username or password |

The `401` is identical for an unknown username and a wrong password, so the
endpoint does not reveal which accounts exist.

### `POST /tasks/` — create a task

Authenticated. The owner is taken from the token, not the request body, so a
caller cannot create a task on somebody else's behalf.

```json
{ "title": "Write docs", "description": "Cover the auth flow" }
```

Returns `200` with the created task. `description` is optional.

```json
{ "id": 1, "title": "Write docs", "description": "Cover the auth flow", "completed": false }
```

| Status | Meaning |
|---|---|
| `200` | Created |
| `401` | Missing, malformed, or expired token |
| `422` | Validation failed |

### `GET /tasks/` — list your tasks

Authenticated. Returns only tasks owned by the caller, as a JSON array. Returns
`[]` when there are none. Not paginated.

### `GET /tasks/{task_id}` — fetch one task

Authenticated. Returns the task if the caller owns it.

| Status | Meaning |
|---|---|
| `200` | Found |
| `401` | Missing, malformed, or expired token |
| `404` | No such task **or** the task belongs to another user |

### `PUT /tasks/{task_id}` — update a task

Authenticated. Partial update: **omitted fields are left unchanged.** Send only
what you want to change.

```json
{ "completed": true }
```

Because omission and an explicit `null` are distinguished, `description` can be
cleared by sending `null` for it. `title` and `completed` are not nullable in the
database, so sending `null` for either is rejected with `422` rather than
failing at the database layer.

| Request body | Effect |
|---|---|
| `{}` | No change |
| `{"completed": true}` | Sets `completed`, leaves title and description alone |
| `{"description": null}` | Clears the description |
| `{"title": null}` | `422` — title may be omitted, but not null |
| `{"title": ""}` | `422` — title must be at least 1 character |

| Status | Meaning |
|---|---|
| `200` | Updated, returns the full task |
| `401` | Missing, malformed, or expired token |
| `404` | No such task **or** the task belongs to another user |
| `422` | Validation failed |

### `DELETE /tasks/{task_id}` — delete a task

Authenticated.

```json
{ "detail": "Task deleted successfully" }
```

| Status | Meaning |
|---|---|
| `200` | Deleted |
| `401` | Missing, malformed, or expired token |
| `404` | No such task **or** the task belongs to another user |

---

## Validation rules

Enforced by Pydantic in `schemas.py` before anything reaches the database.
Failures return `422` with a per-field message.

| Field | Rule |
|---|---|
| `username` | 3–50 characters, matching `^[A-Za-z0-9_-]+$` |
| `password` | at least 8 characters, and at most **72 bytes** |
| `title` | 1–200 characters, required on create |
| `description` | at most 2000 characters, optional and nullable |
| `completed` | boolean, defaults to `false` |

Two rules are worth explaining.

**The username pattern** rejects whitespace and non-ASCII characters. Without it,
`alice` and `аlice` (Cyrillic `а`) are different rows that look identical to a
human, which is a straightforward impersonation vector.

**The password limit is measured in bytes, not characters,** because bcrypt hashes
only the first 72 bytes of its input and silently ignores the rest. A 72-character
password of multi-byte characters is 144 bytes, so a character-based limit would
accept it and then quietly discard half of it — the user would believe they had a
strong passphrase when they did not. TaskHub rejects it instead.

---

## Data model

```
users                        tasks
-----                        -----
id               PK          id           PK
username         unique      title        not null
hashed_password  not null    description  nullable
                             completed    default false
                             owner_id     FK -> users.id
```

One user has many tasks. `hashed_password` stores a bcrypt hash and is never
exposed by the API.

---

## Project structure

```
task-api/
├── config.py         Loads and validates environment configuration
├── database.py       Engine, session factory, get_db dependency
├── models.py         SQLAlchemy models — database shape
├── schemas.py        Pydantic models — API shape, request and response
├── auth.py           Hashing, token issuing, auth dependencies
├── main.py           FastAPI app and route handlers
├── requirements.txt  Pinned dependencies
├── .env.example      Config template (safe to commit)
└── .env              Real config (gitignored)
```

The split is deliberate: `models.py` describes what the database stores,
`schemas.py` describes what crosses the network, and the two are kept separate so
that internal columns cannot leak into responses just because they exist on a row.

`auth.py` exposes two dependencies:

- `get_current_user` — resolves the bearer token to a `User`, or raises `401`.
- `get_owned_task` — resolves a path `task_id` to a task the caller owns, or
  raises `404`. Endpoints operating on one task depend on this instead of
  repeating the lookup, so ownership enforcement cannot be forgotten.

---

## Design decisions

**A task you don't own returns `404`, not `403`.** Returning `403` would confirm
that a given task ID exists, letting any authenticated user enumerate the ID space
and learn how many tasks exist. Both cases are therefore reported identically.
Ownership is expressed as part of the SQL `WHERE` clause rather than a follow-up
`if`, so there is no code path that fetches a row before checking who owns it.

**Task responses omit `owner_id`.** A caller can only ever retrieve its own tasks,
so the field carries no information while exposing an internal foreign key.

**Responses are filtered by explicit schemas.** Every endpoint declares a
`response_model`. Returning ORM objects directly would serialize whatever
attributes happened to be loaded, which means an unrelated change — eager-loading
a relationship, say — could start including a related user's `hashed_password` in
responses with nothing failing to signal it.

**Registration checks for a duplicate username *and* handles the constraint
violation.** The pre-check produces a clean `409`; the `IntegrityError` handler
catches the case where a concurrent request registers the same name in between.
The unique constraint is the actual guarantee. The check also runs before password
hashing, so rejected attempts don't pay bcrypt's cost.

**Timestamps are timezone-aware.** `create_access_token` uses
`datetime.now(timezone.utc)`. The older `datetime.utcnow()` is deprecated on
Python 3.12+ and returns a naive value that compares incorrectly against
aware datetimes.

---

## Known limitations

Roughly in priority order.

- **No tests.** Nothing currently guards the behavior described above against
  regression.
- **No migrations.** `Base.metadata.create_all()` runs at import and only ever
  creates missing tables — it never alters existing ones, so any column change
  requires manual intervention. Adopt Alembic before there is data worth keeping.
- **`owner_id` is nullable and unindexed.** Nothing at the schema level prevents
  an orphaned task, and every task query filters on this column.
- **Status codes are conventional rather than strict.** Creates return `200`
  where `201` would be correct, and `DELETE` returns `200` with a body where
  `204` would be. Changing them is a client-visible change, so it hasn't been done.
- **OpenAPI only documents `200` and `422`.** The `401`, `404`, and `409`
  responses are raised at runtime and not declared, so they don't appear in
  `/docs`. Adding `responses={...}` to each route would fix this.
- **`401` responses are missing `WWW-Authenticate` on some paths.** FastAPI adds
  the header when a token is absent, but the handwritten `401`s for an invalid or
  expired token do not, so clients can't reliably discover how to reauthenticate.
- **`/login` has no `response_model`,** returning a bare dict, so the token shape
  isn't part of the documented contract.
- **`GET /tasks/` is unpaginated** and returns every task the user owns.
- **`passlib` and `python-jose` are unmaintained.** Both work on the pinned
  versions. `passlib` 1.7.4 predates Python 3.13's removal of the stdlib `crypt`
  module and works here only because the bcrypt backend does not touch it, and it
  reads a `bcrypt` attribute removed in bcrypt 4.1 — hence the pin to 4.0.1.
  Longer term, migrate to `pwdlib[bcrypt]` and `pyjwt`.
- **No rate limiting** on `/login` or `/users/`, so nothing throttles credential
  stuffing or bulk registration.
