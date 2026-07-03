# ⚡ FlekxiTask Job Marketplace

A full-stack part-time job marketplace connecting workers with flexible local tasks. Workers register instantly via Google, browse tasks near them, and apply with one tap.

---

## Architecture Overview

```
FlekxiTaskJobMarketplace/
├── backend/              # Python FastAPI REST API
├── frontend/
│   ├── web/              # React + Tailwind CSS (workers & employers)
│   ├── admin/            # React admin dashboard
│   └── mobile/           # React Native (iOS 14+ & Android 10+)
├── k8s/                  # Kubernetes manifests
├── docker-compose.yml    # Full stack local setup
└── docker-compose.dev.yml# Infrastructure only (DB + Redis)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Web | React 18, Vite, Tailwind CSS |
| Admin Dashboard | React 18, Vite, Tailwind CSS, Recharts |
| Mobile | React Native 0.76 (iOS 14+, Android 10+) |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async) |
| Database | PostgreSQL 16 |
| Caching / Sessions | Redis 7 |
| Push Notifications | Firebase Cloud Messaging |
| Auth | Google OAuth 2.0 + JWT (access + refresh tokens) |
| Container Orchestration | Kubernetes + NGINX Ingress |

---

## Features

### Registration & Profile
- **Google OAuth** one-click registration — no forms needed
- Add **skills**, **location**, and **bio** to your profile
- **Upload a profile photo** (JPEG/PNG/WebP, max 5MB)

### Task Discovery & Application
- Browse all open tasks on the home screen
- **Filter by location, category, and pay rate**
- See **pay rate per minute** and calculated total pay upfront
- Read full task description and requirements before applying
- **One-tap application** with optional cover note
- Real-time **push notifications** on application status changes (approved/rejected)

---

## Quick Start (Docker Compose)

### Prerequisites
- Docker 24+ and Docker Compose v2
- Firebase project (for push notifications)
- Google OAuth credentials

### 1. Configure Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials
```

### 2. Add Firebase Credentials
Place your Firebase service account JSON at `backend/firebase-credentials.json`.

### 3. Start All Services
```bash
docker compose up --build
```

### One-Command Local Start
```bash
./scripts/local-up.sh
```

This helper script:
- checks Docker and Docker Compose availability
- creates `backend/.env` from `backend/.env.example` if missing
- starts the full stack with build in detached mode

| Service | URL |
|---|---|
| Web App | http://localhost:3000 |
| Admin Dashboard | http://localhost:3001 |
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Local Development (without Docker)

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt

# Start infrastructure only
docker compose -f ../docker-compose.dev.yml up -d

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

### Frontend Web
```bash
cd frontend/web
npm install
npm run dev       # http://localhost:5173
```

### Admin Dashboard
```bash
cd frontend/admin
npm install
npm run dev       # http://localhost:5174
```

### Mobile (React Native)
```bash
cd frontend/mobile
npm install
# iOS
npx pod-install ios
npx react-native run-ios
# Android
npx react-native run-android
```

---

## API Reference

Base URL: `http://localhost:8000/api/v1`

Interactive docs at: `http://localhost:8000/docs`

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/google` | Sign in / register with Google ID token |
| POST | `/auth/login` | Email + password login |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Revoke access token |

### Users
| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/me` | Get current user profile |
| PUT | `/users/me` | Update profile (name, location, skills, bio) |
| POST | `/users/me/photo` | Upload profile photo |
| PUT | `/users/me/fcm-token` | Update Firebase push token |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| GET | `/tasks` | List tasks (filters: location, category, min_pay, max_pay) |
| GET | `/tasks/{id}` | Get task detail |
| POST | `/tasks` | Create a task (employer) |
| PUT | `/tasks/{id}` | Update a task |
| DELETE | `/tasks/{id}` | Delete a task |

### Applications
| Method | Endpoint | Description |
|---|---|---|
| POST | `/applications` | Apply for a task (one-tap) |
| GET | `/applications/my` | Get my applications |
| GET | `/applications/task/{task_id}` | Get task's applications (employer) |
| PATCH | `/applications/{id}/status` | Approve / reject application |

---

## Kubernetes Deployment

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Secrets (update values first!)
kubectl apply -f k8s/backend/secret.yaml

# Infrastructure
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/redis/

# Applications
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/admin/

# Ingress
kubectl apply -f k8s/ingress.yaml
```

### Horizontal Auto-scaling
The backend automatically scales from 2 to 10 replicas based on CPU (>70%) and memory (>80%).

```bash
kubectl apply -f k8s/backend/hpa.yaml
```

---

## Cheap Cloud Deployment (Single VPS)

The lowest-cost production setup for this repo is one small VPS running the existing Docker Compose stack, with Caddy on the host terminating HTTPS.

### Recommended Spec
- Provider: Hetzner Cloud or similar VPS host
- Size: 2 vCPU, 4 GB RAM, Ubuntu 24.04
- DNS:
	- `yourdomain.com` -> web app
	- `admin.yourdomain.com` -> admin app
	- `api.yourdomain.com` -> backend

### 1. Prepare Environment Files

Copy the backend template and set production values:

```bash
cp backend/.env.example backend/.env
```

Set at least:
- `SECRET_KEY`
- `DATABASE_URL=postgresql+asyncpg://fleksi:<same-password-as-deploy-.env.prod>@postgres:5432/flekxitask`
- `REDIS_URL=redis://redis:6379/0`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ALLOWED_ORIGINS=["https://yourdomain.com","https://admin.yourdomain.com"]`

Optional first-admin bootstrap values in `backend/.env`:
- `BOOTSTRAP_ADMIN_EMAIL=enghoo2004@gmail.com`
- `BOOTSTRAP_ADMIN_PASSWORD=Admin@123`
- `BOOTSTRAP_ADMIN_FULL_NAME=Eng Hoo`

Place your Firebase service account file at `backend/firebase-credentials.json`.

### 2. Build for Production API Hosts

Copy the production deployment template:

```bash
cp deploy/.env.prod.example deploy/.env.prod
```

Update the hostnames, API URL values, and `POSTGRES_PASSWORD` in `deploy/.env.prod`.

If host port `8000` is already in use on the VPS, also set an alternate backend port in `deploy/.env.prod`:
- `BACKEND_HOST_PORT=8001`

If you want to reach the web app directly by server IP for testing, set:
- `WEB_BIND_HOST=0.0.0.0`
- `WEB_HOST_PORT=3000`

That will expose the web container on `http://SERVER_IP:3000`.

If host port `3000` is already in use on the VPS, change `WEB_HOST_PORT` to another value such as `3002` and reload Caddy with the same variable.

For the admin app, use the equivalent settings if you need direct host or IP access:
- `ADMIN_BIND_HOST=127.0.0.1` for domain-only access through Caddy
- `ADMIN_BIND_HOST=0.0.0.0` for direct IP access
- `ADMIN_HOST_PORT=3001` or another free port such as `3003`

If you use Caddy on the host, export the same value before reloading so the API proxy target stays aligned.

### 3. Start the Stack

```bash
docker compose --env-file deploy/.env.prod -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

### 4. Verify the Backend

```bash
curl http://localhost:8000/health
docker compose ps
```

### 4a. Create the First Admin Account

If `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` are set in `backend/.env`, the backend will auto-create the first admin account on startup.

For the requested account:

```env
BOOTSTRAP_ADMIN_EMAIL=enghoo2004@gmail.com
BOOTSTRAP_ADMIN_PASSWORD=Admin@123
BOOTSTRAP_ADMIN_FULL_NAME=Eng Hoo
```

After the first successful deploy, remove or rotate `BOOTSTRAP_ADMIN_PASSWORD` so later restarts do not keep bootstrap credentials around in your deployment configuration.

You can still run the manual bootstrap command if needed:

```bash
docker compose --env-file deploy/.env.prod -f docker-compose.yml -f deploy/docker-compose.prod.yml exec backend \
	python -m app.scripts.create_admin \
	--email enghoo2004@gmail.com \
	--password 'Admin@123' \
	--full-name 'Eng Hoo'
```

### 5. Configure Caddy on the VPS Host

Use `deploy/Caddyfile` as the starting point. Export the three host variables before reloading Caddy:

If you changed `BACKEND_HOST_PORT`, export that too.

```bash
export WEB_HOST=yourdomain.com
export ADMIN_HOST=admin.yourdomain.com
export API_HOST=api.yourdomain.com
sudo systemctl reload caddy
```

### Notes
- The web and admin frontends now support `VITE_API_BASE_URL` at build time.
- The production override binds ports `3000`, `3001`, and `8000` to `127.0.0.1`, so they are reachable through Caddy on the VPS but not directly exposed to the internet.
- Uploaded media is stored on the VPS disk via the `media_data` Docker volume. Back that volume up before resizing or rebuilding the server.
- The mobile app still contains emulator-only API URLs and should be configured separately before mobile release.

---

## Project Structure (Backend)

```
backend/
├── app/
│   ├── main.py            # FastAPI app, lifespan, middleware
│   ├── config.py          # Pydantic settings
│   ├── database.py        # Async SQLAlchemy engine
│   ├── models/            # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── task.py
│   │   └── application.py
│   ├── schemas/           # Pydantic request/response schemas
│   ├── api/v1/            # Route handlers
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── tasks.py
│   │   └── applications.py
│   └── core/
│       ├── security.py    # JWT, bcrypt
│       ├── redis_client.py# Session & token blacklist
│       ├── firebase.py    # FCM push notifications
│       └── deps.py        # FastAPI dependencies
└── alembic/               # Database migrations
```

---

## Security Notes
- All passwords hashed with **bcrypt** (12 rounds)
- JWT tokens use **RS256** via `python-jose`
- Logout blacklists tokens in **Redis**
- File uploads validated by **MIME type** and size limit
- CORS restricted to known origins
- SQL injection prevented via **parameterised SQLAlchemy** queries

---

## License
MIT
