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
