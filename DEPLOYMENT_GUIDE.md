# Quick Deployment Fix for CORS Issue

## The Problem
Your Vercel frontend (https://scraper.vercel.app) is trying to access `http://localhost:3001` which doesn't exist in production, causing the mixed content security error.

## Quick Solutions

### Option 1: Deploy Backend to Railway (Web Interface)
1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `Scraper` repository
5. Select the `backend` folder as the root directory
6. Set these environment variables:
   - `NODE_ENV=production`
   - `PORT=3000`
   - Add your API keys from your local .env file

### Option 2: Update Vercel Environment Variables
1. Go to https://vercel.com/dashboard
2. Find your deployed project
3. Go to Settings → Environment Variables
4. Add: `NEXT_PUBLIC_API_BASE_URL` = `https://your-backend-url.railway.app`
5. Redeploy your frontend

Recommended CORS setting on backend (Railway): set `ALLOWED_ORIGINS` to your Vercel domain, e.g.
```
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### Option 3: Quick Local Testing
For immediate testing, update your frontend's `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Then run your backend locally:
```bash
cd backend
npm start
```

## Backend URL will be available at:
Once deployed to Railway, your backend will be at:
`https://[project-name]-production.up.railway.app`

Update this URL in your Vercel environment variables.

## Option 4: Run Locally with Docker (Backend + Frontend + Postgres)

Prerequisites: Docker Desktop 4.x

1) Create env files if not present
- Copy `backend/env.example` to `backend/.env` and fill in values (SUPABASE, OPENAI optional)
- Ensure `backend/.env` includes database vars if you override defaults

2) Start the full stack
```bash
docker compose up --build
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001 (health: /api/health/ping)
- Postgres: localhost:5432 (db: feedback_intelligence, user: postgres, pw: postgres)

Notes:
- The database is initialized with a simplified schema (no pgvector needed) from `backend/database/schema_simple.sql`.
- Frontend is built with `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`.
- Logs are written inside the backend container; uncomment the volume in `docker-compose.yml` to persist them.

## Deploying

Frontend (Vercel)
- Set project root to `frontend` in Vercel.
- Ensure env var `NEXT_PUBLIC_API_BASE_URL=https://<railway-backend>.railway.app`.
- vercel.json at repo root routes traffic to `frontend/` and configures the Next build.

Backend (Railway)
- Root directory: `backend`
- Start command: `npm start`
- Env vars: `PORT=3000`, `NIXPACKS_NODE_VERSION=20`, DB vars or `DATABASE_URL`, optional `ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app`

Common commands:
```bash
# Start in background
docker compose up -d --build

# Tail logs
docker compose logs -f backend

# Stop and remove containers (preserves DB data)
docker compose down

# Nuke DB data
docker compose down -v
```
