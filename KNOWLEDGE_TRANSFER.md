# FlekxiTask Job Marketplace — Knowledge Transfer Document

> **Last updated:** 2026-06-29  
> **Production domain:** `flekxi.my`  
> **Repository root:** `FleksiTaskJobMarketplace/`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Backend (FastAPI)](#5-backend-fastapi)
   - 5.1 [Configuration & Environment Variables](#51-configuration--environment-variables)
   - 5.2 [Database & ORM](#52-database--orm)
   - 5.3 [Data Models](#53-data-models)
   - 5.4 [API Routes](#54-api-routes)
   - 5.5 [Authentication & Security](#55-authentication--security)
   - 5.6 [Task Session & Timer Logic](#56-task-session--timer-logic)
   - 5.7 [Wallet & Payments](#57-wallet--payments)
   - 5.8 [Push Notifications (Firebase)](#58-push-notifications-firebase)
   - 5.9 [Email (SMTP)](#59-email-smtp)
   - 5.10 [File Uploads](#510-file-uploads)
   - 5.11 [Redis & Token Blacklisting](#511-redis--token-blacklisting)
   - 5.12 [Database Migrations (Alembic)](#512-database-migrations-alembic)
6. [Frontend — Web App](#6-frontend--web-app)
7. [Frontend — Admin Dashboard](#7-frontend--admin-dashboard)
8. [Frontend — Mobile (React Native)](#8-frontend--mobile-react-native)
9. [Frontend — Flutter (iOS / Android)](#9-frontend--flutter-ios--android)
10. [Local Development Setup](#10-local-development-setup)
11. [Docker Compose](#11-docker-compose)
12. [Kubernetes (k8s) Deployment](#12-kubernetes-k8s-deployment)
13. [VPS / Single-Server Deployment (Caddy)](#13-vps--single-server-deployment-caddy)
14. [Admin Bootstrap](#14-admin-bootstrap)
15. [Known Gotchas & Design Decisions](#15-known-gotchas--design-decisions)
16. [Onboarding Checklist](#16-onboarding-checklist)

---

## 1. Project Overview

FlekxiTask is a **part-time / gig-economy job marketplace** that connects:

- **Workers** — people looking for short, flexible local tasks.
- **Employers** — businesses or individuals who post tasks and hire workers.
- **Admins** — platform operators who manage users, review withdrawals, and monitor the system.

Core user journey:

```
Register (Google OAuth or email)
  → Browse Tasks → Apply with a cover note
    → Employer approves application
      → Worker checks in, works, checks out (with photo proof)
        → Earnings credited to in-app wallet
          → Worker requests bank withdrawal → Admin approves → Paid
```

---

## 2. Architecture Overview

```
                    ┌─────────────────────┐
                    │     flekxi.my        │   Workers & Employers
                    │  (React Web SPA)     │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │   admin.flekxi.my    │   Platform admins
                    │  (React Admin SPA)   │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │    api.flekxi.my     │   REST API
                    │  (FastAPI / Python)  │
                    └──────┬──────┬───────┘
                           │      │
               ┌───────────┘      └───────────┐
      ┌────────┴──────┐             ┌──────────┴──────┐
      │  PostgreSQL 16 │             │    Redis 7       │
      │  (primary DB)  │             │  (token cache /  │
      └───────────────┘             │   session store) │
                                    └─────────────────┘
```

**Ingress routing (Kubernetes):**

| Host | Path | Service |
|------|------|---------|
| `flekxi.my` | `/api`, `/media` | `backend-service:8000` |
| `flekxi.my` | `/` | `frontend-web-service:80` |
| `admin.flekxi.my` | `/` | `admin-service:80` |
| `api.flekxi.my` | `/` | `backend-service:8000` |

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend API | Python / FastAPI | 3.12 / 0.115 |
| ORM | SQLAlchemy (async) | 2.0 |
| DB driver | asyncpg | 0.29 |
| Database | PostgreSQL | 16 |
| Cache / Session | Redis | 7 |
| Migrations | Alembic | 1.13 |
| Auth | Google OAuth 2.0 + JWT (HS256) | — |
| Password hashing | bcrypt | 4.2 |
| Push notifications | Firebase Admin SDK (FCM) | 6.5 |
| Frontend Web | React 18 + Vite + Tailwind CSS | — |
| Admin Dashboard | React 18 + Vite + Tailwind + Recharts | — |
| Mobile | React Native | 0.76 |
| Mobile (alt) | Flutter | — |
| Container orchestration | Kubernetes + NGINX Ingress | — |
| TLS / reverse proxy | Caddy (VPS) or cert-manager (k8s) | — |

---

## 4. Repository Structure

```
FleksiTaskJobMarketplace/
├── backend/                   # Python FastAPI application
│   ├── app/
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── config.py          # Pydantic settings (reads .env)
│   │   ├── database.py        # SQLAlchemy async engine & session
│   │   ├── api/v1/            # Route handlers (one file per resource)
│   │   ├── core/              # Auth helpers, Firebase, Redis, email
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   └── scripts/           # CLI utilities (create_admin)
│   ├── alembic/               # DB migration scripts
│   ├── requirements.txt
│   ├── Dockerfile
│   └── firebase-credentials.json   # ⚠️ Secret — never commit to public repos
│
├── frontend/
│   ├── web/                   # Worker / Employer React SPA
│   ├── admin/                 # Admin React SPA
│   ├── mobile/                # React Native app
│   └── flutter/               # Flutter mobile app
│
├── k8s/                       # Kubernetes manifests
│   ├── namespace.yaml
│   ├── ingress.yaml
│   ├── cert-manager-issuer.yaml
│   ├── backend/               # Deployment, Service, ConfigMap, Secret, HPA, PVC
│   ├── frontend/              # Web deployment & service
│   ├── admin/                 # Admin deployment & service
│   ├── postgres/              # StatefulSet, PVC, Service
│   └── redis/                 # Deployment & Service
│
├── deploy/                    # VPS deployment helpers
│   ├── Caddyfile              # Caddy reverse proxy config
│   ├── docker-compose.prod.yml
│   ├── deploy.sh / deploy.ps1
│   └── rebuild-redeploy-web-k8s.*
│
├── docker-compose.yml         # Full local stack
└── docker-compose.dev.yml     # Infrastructure only (Postgres + Redis)
```

---

## 5. Backend (FastAPI)

### 5.1 Configuration & Environment Variables

All configuration lives in `backend/app/config.py` using `pydantic-settings`. Values are read from `backend/.env` (or environment variables in containers).

**Required variables (no default — must be set):**

| Variable | Description |
|---|---|
| `SECRET_KEY` | JWT signing secret (generate with `openssl rand -hex 32`) |
| `DATABASE_URL` | AsyncPG connection string, e.g. `postgresql+asyncpg://user:pass@host/db` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Client Secret |

**Optional variables with defaults:**

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `FIREBASE_CREDENTIALS_PATH` | `firebase-credentials.json` | Path to service account JSON |
| `MEDIA_DIR` | `media` | Upload storage directory |
| `MAX_UPLOAD_SIZE_MB` | `5` | Max file upload size |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | JWT refresh token TTL |
| `ALLOWED_ORIGINS` | `["http://localhost:3000","http://localhost:5173"]` | CORS whitelist |
| `FRONTEND_URL` | `http://localhost:3000` | Used in password reset emails |
| `BOOTSTRAP_ADMIN_EMAIL` | _(none)_ | Auto-create admin on first boot |
| `BOOTSTRAP_ADMIN_PASSWORD` | _(none)_ | Auto-create admin on first boot |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM/TLS` | _(empty)_ | Email config |

**Kubernetes ConfigMap** (`k8s/backend/configmap.yaml`) sets non-secret env vars.  
**Kubernetes Secret** (`k8s/backend/secret.yaml`) holds `SECRET_KEY`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_USER`, `SMTP_PASSWORD`, etc.

---

### 5.2 Database & ORM

- **Engine:** `create_async_engine` with connection pooling (`pool_size=10`, `max_overflow=20`).
- **Session factory:** `async_sessionmaker` — injected per-request via `get_db()` dependency.
- **Schema creation:** `init_db()` is called at startup via the FastAPI `lifespan` hook. It runs `Base.metadata.create_all` (idempotent).
- A runtime migration step in `init_db()` converts the `task_sessions.status` column to `VARCHAR(20)` if it was previously an enum type — this normalises legacy data.

---

### 5.3 Data Models

#### User (`models/user.py`)
| Field | Notes |
|---|---|
| `id` | UUID PK |
| `email` | Unique, indexed |
| `google_id` | Unique; set for Google-authenticated users |
| `hashed_password` | bcrypt; `None` for Google-only users |
| `skills` | JSON array stored as string |
| `fcm_token` | Firebase Cloud Messaging device token |
| `is_employer` | Employers can create tasks |
| `is_admin` | Grants access to `/admin/*` endpoints |
| `is_verified` | Always `True` after Google sign-in |
| `latitude/longitude` | Worker's optional location |
| `nric_passport` | Identity document number |

#### Task (`models/task.py`)
| Field | Notes |
|---|---|
| `employer_id` | FK → users |
| `pay_rate_per_minute` | Float — earnings per minute worked |
| `estimated_duration_minutes` | Task time limit (also the payment cap) |
| `status` | `open` → `in_progress` → `completed` / `cancelled` |
| `max_applicants` | How many workers can be approved |
| `starts_at` | Optional scheduled start; tasks don't appear in listings before this time |
| `category` | Free-text category string |

#### Application (`models/application.py`)
| Field | Notes |
|---|---|
| `status` | `pending` → `approved` / `rejected` / `withdrawn` |
| `cover_note` | Optional text from worker |
| `reviewed_at` | Timestamp when employer/admin changed status |

#### TaskSession (`models/task_session.py`)
| Field | Notes |
|---|---|
| `checked_in_at` | UTC timestamp of check-in (recalculated on resume) |
| `checked_out_at` | UTC timestamp of checkout |
| `earnings` | Final calculated earnings (null until checkout) |
| `status` | `active` / `paused` / `completed` |
| `proof_photo_url` | S3/local path to checkout photo |
| `rating` | 1.0–5.0 worker rating (post-checkout) |

#### Wallet (`models/wallet.py`)
- **Wallet** — one per user; `available_balance` (confirmed, withdrawable).
- **Transaction** — credit/debit history; types: `CREDIT`, `WITHDRAWAL_PENDING`, `WITHDRAWAL_COMPLETED`, `WITHDRAWAL_REJECTED`.
- **BankAccount** — one per user; name, number, bank name.
- **WithdrawalRequest** — snapshot of bank details at request time; admin approves/rejects.

---

### 5.4 API Routes

Base prefix: `/api/v1`

| Router | Prefix | Key Endpoints |
|---|---|---|
| `auth.py` | `/auth` | `POST /google`, `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `POST /forgot-password`, `POST /reset-password` |
| `users.py` | `/users` | `GET /me`, `PUT /me`, `POST /me/photo`, `PUT /me/location`, `PUT /me/fcm-token` |
| `tasks.py` | `/tasks` | `GET /` (paginated + filtered), `GET /{id}`, `POST /` (employer), `PUT /{id}` (employer), `DELETE /{id}`, `POST /{id}/photo` |
| `applications.py` | `/applications` | `POST /` (worker apply), `GET /my`, `PUT /{id}/status` (employer approve/reject), `DELETE /{id}` (withdraw) |
| `task_sessions.py` | `/task-sessions` | `POST /checkin`, `POST /{id}/checkout`, `POST /{id}/pause`, `POST /{id}/resume`, `GET /my`, `GET /active`, `GET /{id}/earnings` |
| `wallet.py` | `/wallet` | `GET /` (balance), `GET /transactions`, `POST /bank-account`, `GET /bank-account`, `POST /withdraw`, `GET /withdrawals` |
| `messages.py` | `/messages` | `GET /` (conversations list), `GET /{user_id}` (thread), `POST /` (send) |
| `files.py` | `/files` | `POST /upload` (generic file upload) |
| `admin.py` | `/admin` | Applications, tasks, users, sessions, withdrawals CRUD — all require `is_admin=True` |

Interactive API docs available at `/docs` (Swagger UI) and `/redoc`.

---

### 5.5 Authentication & Security

**Two authentication paths:**

1. **Google OAuth (`POST /auth/google`)**
   - Client sends Google `id_token` (obtained from Google Sign-In SDK).
   - Backend verifies token with `google-auth` library, checks `aud` == configured `GOOGLE_CLIENT_ID`.
   - User is created on first sign-in or matched by `google_id` / `email`.
   - Returns `access_token` + `refresh_token`.

2. **Email/Password (`POST /auth/register`, `POST /auth/login`)**
   - Password hashed with bcrypt (12 rounds).
   - Returns `access_token` + `refresh_token`.
   - Password reset: sends a time-limited token by email; `POST /auth/reset-password` validates and re-hashes.

**JWT tokens:**
- Algorithm: HS256 signed with `SECRET_KEY`.
- Access token TTL: 60 minutes (default).
- Refresh token TTL: 7 days (default).
- Both tokens carry `{"sub": "<user_uuid>", "type": "access"|"refresh"}`.

**Token blacklisting (logout):**
- On `POST /auth/logout`, the access token is added to Redis under `blacklist:<token>` with a TTL matching the remaining token lifetime.
- Every authenticated request checks `is_token_blacklisted()` before accepting.

**Dependency injection pattern:**
```python
get_current_user   # Any authenticated user
get_current_admin  # User where is_admin=True
require_admin      # Admin-only (used inside admin router)
```

---

### 5.6 Task Session & Timer Logic

This is one of the most complex parts of the platform. See also the [frontend timer notes](#6-frontend--web-app).

**Backend flow:**

```
Worker checks in → TaskSession created (status=ACTIVE, checked_in_at=now())
Worker pauses    → checked_out_at=now(), earnings calculated and cached, status=PAUSED
Worker resumes   → checked_in_at recalculated backwards to preserve worked time
                   checked_in_at = now() - timedelta(minutes=worked_minutes)
Worker checks out → finalize_checkout() called
```

**`finalize_checkout()` logic:**
1. `elapsed_minutes = (now - checked_in_at).total_seconds() / 60`
2. Capped to `estimated_duration_minutes` — prevents overcharging when checkout form takes time to submit.
3. `earnings = round(elapsed_minutes × pay_rate_per_minute, 2)`
4. `minimum_duration_met = elapsed_minutes >= estimated_duration_minutes`
5. If met: task status → `COMPLETED`, wallet `available_balance` increased, `Transaction(CREDIT)` created.

**Constraint:** Only one `ACTIVE` session per worker at a time (enforced in check-in endpoint).

---

### 5.7 Wallet & Payments

- **Available balance** — confirmed, withdrawable funds from completed sessions.
- **Pending balance** — real-time estimate from currently active/paused sessions (computed on-the-fly in `GET /wallet`, not stored).
- **Withdrawal flow:** Worker requests withdrawal → admin approves/rejects via admin dashboard → status transitions: `PENDING` → `APPROVED` or `REJECTED`.
- Bank details are **snapshotted** at time of withdrawal request so changes to `BankAccount` don't affect in-flight withdrawals.

---

### 5.8 Push Notifications (Firebase)

- Initialized at app startup via `init_firebase()` in `lifespan`.
- Firebase service account JSON must exist at `FIREBASE_CREDENTIALS_PATH`.
- If Firebase init fails (missing credentials), the app continues — push notifications are silently disabled.
- Workers save their FCM token via `PUT /users/me/fcm-token`.
- Notifications are sent on: application approved, application rejected (see `core/firebase.py`).

---

### 5.9 Email (SMTP)

- Used only for **password reset** emails.
- Configured via `SMTP_*` environment variables.
- STARTTLS on port 587 by default (`SMTP_TLS=true`).
- If SMTP credentials are not set, email sending is skipped / logged.
- Implementation: `core/email.py` using `aiosmtplib`.

---

### 5.10 File Uploads

- Photos (profile, task, checkout proof) are stored locally in `MEDIA_DIR` (default: `media/`).
- In production (k8s) a **PersistentVolumeClaim** (`k8s/backend/media-pvc.yaml`) mounts at `/app/media`.
- Files are served as static files at `/media/<filename>` via FastAPI's `StaticFiles` mount.
- Max file size: `MAX_UPLOAD_SIZE_MB` (default 5 MB). Types accepted: JPEG, PNG, WebP.
- Filenames are UUID-prefixed to avoid collisions.

---

### 5.11 Redis & Token Blacklisting

Redis serves two purposes:

| Purpose | Key pattern | TTL |
|---|---|---|
| Token blacklist (logout) | `blacklist:<jwt_token>` | Remaining token lifetime |
| Session/temp store (password reset) | `<key>` | `REDIS_SESSION_TTL` (default 24h) |

Redis connection is lazy-initialized and cleaned up on app shutdown.

---

### 5.12 Database Migrations (Alembic)

| Migration | Description |
|---|---|
| `0001_initial.py` | Creates all tables: users, tasks, applications, task_sessions, wallets, transactions, bank_accounts, withdrawal_requests, messages |
| `0002_add_paused_session_status.py` | Adds `paused` to the session status enum |
| `0003_add_user_profile_fields.py` | Adds `academic_qualification`, `body_height_cm`, `nationality`, `race`, `nric_passport` to users |

**Running migrations:**
```bash
cd backend
alembic upgrade head      # Apply all pending migrations
alembic downgrade -1      # Roll back one migration
alembic history           # Show migration history
```

> **Note:** `init_db()` at startup calls `create_all` (idempotent), but Alembic is the canonical migration tool for schema changes. Do not mix the two for production schema changes.

---

## 6. Frontend — Web App

**Location:** `frontend/web/`  
**URL:** `http://localhost:3000` (dev), `https://flekxi.my` (prod)

### Tech
- React 18 + Vite + Tailwind CSS
- State management: React Context / local state (no Redux)
- API calls: custom client in `src/api/`

### Pages

| Page | Route | Description |
|---|---|---|
| `Home.jsx` | `/` | Browse & filter open tasks |
| `TaskDetail.jsx` | `/tasks/:id` | Full task info + apply button |
| `TaskTracking.jsx` | `/track/:sessionId` | Live timer, pause/checkout |
| `MyApplications.jsx` | `/applications` | Worker's application history |
| `History.jsx` | `/history` | Past completed sessions |
| `Wallet.jsx` | `/wallet` | Balance, transactions, withdrawals |
| `Messages.jsx` | `/messages` | In-app messaging |
| `Profile.jsx` | `/profile` | Edit profile, skills, photo |
| `Login.jsx` | `/login` | Email/Google sign in |
| `Register.jsx` | `/register` | Email/Google sign up |
| `ResetPassword.jsx` | `/reset-password` | Password reset via email token |

### Timer Logic (`TaskTracking.jsx`)
- **Polling interval:** 250 ms
- **Elapsed time:** `Math.floor((Date.now() - checkedInAt) / 1000)` seconds
- **Cap:** `estimated_duration_minutes * 60` — timer stops at this cap
- **Real-time earnings display:** `(displayElapsed / 60) * payRate`, capped at `maxEarnings`
- **Auto-stop:** When `elapsed >= cap`, interval is cleared and checkout form is shown
- **Safety net:** `useEffect` also monitors elapsed vs cap in case the interval misses a tick

### Runtime Configuration (Kubernetes)
The web container writes `/runtime-config.js` at startup from environment variables. This allows a single pre-built Docker image to work across different environments. `VITE_GOOGLE_CLIENT_ID` is injected at runtime from the `fleksitask-secrets` Kubernetes secret.

```javascript
// src/config/runtime.js
export function getPublicConfig(key) { ... }
```

> **Known bug (fixed):** The Register page previously gated Google Sign-In on `import.meta.env.VITE_GOOGLE_CLIENT_ID`. This fails for pre-built images because Vite bakes env vars at build time. Always use `getPublicConfig('VITE_GOOGLE_CLIENT_ID')` instead.

### API Base URL
- In production, the web app defaults to same-origin `/api/v1` unless `VITE_API_BASE_URL` is explicitly set.
- The Admin frontend infers `api.<domain>` from the current host if `VITE_API_BASE_URL` is a placeholder value like `api.yourdomain.com`.

---

## 7. Frontend — Admin Dashboard

**Location:** `frontend/admin/`  
**URL:** `http://localhost:3001` (dev), `https://admin.flekxi.my` (prod)

### Pages

| Page | Description |
|---|---|
| `AdminLogin.jsx` | Admin sign-in (email/password only) |
| `Dashboard.jsx` | Stats overview |
| `Tasks.jsx` | Create, edit, delete tasks |
| `Applications.jsx` | View all applications, approve/reject |
| `Users.jsx` | View and manage user accounts |
| `AdminUsers.jsx` | Grant/revoke admin privileges |
| `ActiveWorkers.jsx` | View currently checked-in workers |
| `TimeLogs.jsx` | Historical session records |
| `Withdrawals.jsx` | Process withdrawal requests |
| `Analytics.jsx` | Charts (Recharts) for platform metrics |
| `Messages.jsx` | View message threads |

### State Management
Uses Redux Toolkit (slices in `src/slices/`, store in `src/store/`).

---

## 8. Frontend — Mobile (React Native)

**Location:** `frontend/mobile/`  
**Supports:** iOS 14+, Android 10+

> This app covers basic browsing and application flows. The task tracking timer UI (pause/checkout) is **not yet implemented** in React Native — only in the web app.

---

## 9. Frontend — Flutter (iOS / Android)

**Location:** `frontend/flutter/`  
**Config:** `pubspec.yaml`, `lib/main.dart`

This is an alternative mobile implementation in Flutter. Refer to `frontend/flutter/README.md` for setup steps (requires Flutter SDK, Android Studio or Xcode).

---

## 10. Local Development Setup

### Option A — Full Stack with Docker Compose (recommended)

```bash
# 1. Copy and fill in environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your DB, Redis, Google OAuth, and Firebase credentials

# 2. Place Firebase credentials
# Copy your Firebase service account JSON to:
backend/firebase-credentials.json

# 3. Start everything
docker compose up --build

# Services:
#   Web App:       http://localhost:3000
#   Admin:         http://localhost:3001
#   API:           http://localhost:8000
#   API Docs:      http://localhost:8000/docs
```

### Option B — Infrastructure Only (DB + Redis) + Local Backend

```bash
# Start only postgres and redis
docker compose -f docker-compose.dev.yml up -d

# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Web frontend (new terminal)
cd frontend/web
npm install
npm run dev    # Starts on http://localhost:5173

# Admin (new terminal)
cd frontend/admin
npm install
npm run dev    # Starts on http://localhost:5174
```

### Minimum `.env` for local development

```env
SECRET_KEY=your-random-secret-key-here
DATABASE_URL=postgresql+asyncpg://fleksi:password@localhost:5432/flekxitask
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
REDIS_URL=redis://localhost:6379/0
```

---

## 11. Docker Compose

| File | Purpose |
|---|---|
| `docker-compose.yml` | Full stack: postgres, redis, backend, frontend-web, admin |
| `docker-compose.dev.yml` | Infrastructure only: postgres + redis |
| `deploy/docker-compose.prod.yml` | Production variant with different settings |

**Key environment variable pass-through for frontends:**

```yaml
# Web frontend (docker-compose.yml)
build:
  args:
    VITE_API_BASE_URL: ${WEB_VITE_API_BASE_URL:-}
    VITE_GOOGLE_CLIENT_ID: ${WEB_VITE_GOOGLE_CLIENT_ID:-}
environment:
  VITE_API_BASE_URL: ${WEB_VITE_API_BASE_URL:-}
  VITE_GOOGLE_CLIENT_ID: ${WEB_VITE_GOOGLE_CLIENT_ID:-}
```

Both `build.args` (baked at build time) and `environment` (for runtime-config injection) are set for maximum compatibility.

---

## 12. Kubernetes (k8s) Deployment

All manifests are in `k8s/`. Namespace: `flekxitask`.

### Applying all manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/cert-manager-issuer.yaml
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/admin/
kubectl apply -f k8s/ingress.yaml
```

### Secrets that must be pre-created

The `k8s/backend/secret.yaml` file is a **template** — fill in base64-encoded values before applying:

```bash
# Encode a value
echo -n "my-secret-value" | base64

kubectl apply -f k8s/backend/secret.yaml
```

| Secret name | Keys |
|---|---|
| `flekxitask-secrets` | `SECRET_KEY`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SMTP_USER`, `SMTP_PASSWORD`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `REDIS_URL`, `GOOGLE_CLIENT_ID` (also used for frontend runtime config) |
| `firebase-credentials-secret` | `firebase-credentials.json` (entire JSON file, base64-encoded) |

### Backend pod details
- **Replicas:** 2 (see `deployment.yaml`)
- **HPA:** Configured in `k8s/backend/hpa.yaml` (auto-scales based on CPU)
- **Media PVC:** `k8s/backend/media-pvc.yaml` — shared across replicas for uploaded files
- **Health checks:** `GET /health` (liveness + readiness)
- **Resources:** 256Mi–512Mi RAM, 250m–500m CPU

### Rebuild and redeploy scripts
```bash
# PowerShell (Windows)
deploy/rebuild-redeploy-web-k8s.ps1

# Bash (Linux/macOS)
deploy/rebuild-redeploy-web-k8s.sh

# Update Google Client ID secret and redeploy
deploy/update-google-secret-and-redeploy-web-k8s.ps1
```

---

## 13. VPS / Single-Server Deployment (Caddy)

For a simpler, cheaper production setup on a single VPS:

1. Install Docker + Docker Compose and Caddy on the VPS.
2. Copy `deploy/docker-compose.prod.yml` and configure environment variables.
3. Configure `deploy/Caddyfile`:

```caddyfile
{$WEB_HOST} {
    reverse_proxy localhost:{$WEB_HOST_PORT:3000}
}

{$ADMIN_HOST} {
    reverse_proxy localhost:{$ADMIN_HOST_PORT:3001}
}

{$API_HOST} {
    reverse_proxy localhost:{$BACKEND_HOST_PORT:8000}
}
```

4. Set environment variables for Caddy:

```bash
export WEB_HOST=flekxi.my
export ADMIN_HOST=admin.flekxi.my
export API_HOST=api.flekxi.my
caddy run --config deploy/Caddyfile
```

Caddy automatically obtains and renews Let's Encrypt TLS certificates.

---

## 14. Admin Bootstrap

Creating the first admin account:

**Method 1: Environment variables (auto-created on startup)**
```env
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=strong-password-here
BOOTSTRAP_ADMIN_FULL_NAME=Platform Admin
```
On startup, `bootstrap_admin_account()` creates or promotes this user and resets the password.

**Method 2: CLI script (can be run anytime)**
```bash
cd backend
python -m app.scripts.create_admin --email admin@example.com --password strong-password-here
```

This creates the user if absent, promotes them to admin, and resets their password.

---

## 15. Known Gotchas & Design Decisions

### Authentication
- Google OAuth tokens must have `aud` equal to exactly `GOOGLE_CLIENT_ID`. If the client ID is wrong or trailing whitespace exists, all Google sign-ins will fail with 401.
- The backend verifies Google tokens server-side — **never** trust a Google token verified only on the client.

### Timer / Earnings
- `checked_in_at` is **overwritten on resume** to preserve total worked time across pause/resume cycles. Do not treat `checked_in_at` as "the wall-clock time work started."
- Earnings are **not credited** if `elapsed_minutes < estimated_duration_minutes` (minimum duration not met). The session is still marked completed but no wallet transaction is created.
- The backend caps elapsed time at `estimated_duration_minutes` to prevent overcharging when the checkout form submission is delayed.

### Database Schema
- `task_sessions.status` was originally a PostgreSQL ENUM type. It has been migrated to `VARCHAR(20)`. The `init_db()` function normalises any legacy uppercase enum values (`ACTIVE` → `active`) at startup.
- `skills` on the User model is stored as a JSON-encoded string (not a native array/JSONB column) — parse with `json.loads()` when reading.

### Kubernetes / Runtime Config
- The web frontend Docker image must receive `VITE_GOOGLE_CLIENT_ID` at runtime (not build time) so a single image can be deployed to different environments. This is handled by the entrypoint script writing `/runtime-config.js`.
- The NGINX Ingress must route both `/api` and `/media` paths on `flekxi.my` to `backend-service`. Missing the `/media` route will break all uploaded image display.

### Firebase
- Firebase initialization is **non-fatal**: if `firebase-credentials.json` is missing or invalid, the app starts normally but push notifications are silently disabled.
- FCM tokens expire or become stale. The app updates the token on every login via `PUT /users/me/fcm-token`.

### File Storage
- In a multi-replica Kubernetes deployment, all backend pods mount the **same PVC** (`media-pvc`) at `/app/media`. Do not use local filesystem storage in a way that bypasses this.
- There is no CDN or object storage (S3/GCS) integration. For high-traffic production, consider migrating media uploads to object storage.

### CORS
- `ALLOWED_ORIGINS` must include all frontend origins. In production, update `k8s/backend/configmap.yaml` with the correct domains.

---

## 16. Onboarding Checklist

For a new developer joining the project:

- [ ] Clone the repository
- [ ] Install Docker Desktop (or Docker + Docker Compose on Linux)
- [ ] Create a Google Cloud project and enable the **Google People API** and **OAuth 2.0** credentials
- [ ] Create a Firebase project and download the service account JSON
- [ ] Copy `backend/.env.example` to `backend/.env` and fill in all required values
- [ ] Place `firebase-credentials.json` in `backend/`
- [ ] Run `docker compose up --build` and verify all 4 services start
- [ ] Open `http://localhost:8000/docs` and confirm the API docs load
- [ ] Create an admin user: `python -m app.scripts.create_admin --email ... --password ...`
- [ ] Sign in to the admin dashboard at `http://localhost:3001`
- [ ] Review `KNOWLEDGE_TRANSFER.md` (this document) for architecture details
- [ ] Read `backend/app/api/v1/task_sessions.py` for the core business logic
- [ ] Familiarise yourself with `frontend/web/src/pages/TaskTracking.jsx` for the timer UI

---

*Document generated from codebase analysis as of 2026-06-29.*
