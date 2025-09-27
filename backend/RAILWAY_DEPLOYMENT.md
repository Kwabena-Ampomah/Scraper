# Railway Deployment Configuration

## Backend Deployment to Railway

### Step 1: Prepare Backend for Railway
1. **Start Command**: `npm start`
2. **Build Command**: `npm run build` (if needed)
3. **Node Version**: 20.x

### Step 2: Environment Variables for Railway
Set these in Railway dashboard → Variables:

```env
# Database
DB_HOST=your-supabase-host
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-supabase-password
DB_URL=postgresql://postgres:password@host:5432/postgres

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=your-openai-key

# Server
NODE_ENV=production
PORT=3000
NIXPACKS_NODE_VERSION=20
```

### Step 3: Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Step 4: Get Railway URL
- Railway provides free `your-project.railway.app` domain
- Use this URL in Vercel environment variables

## Railway Configuration Files

### railway.json
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Procfile
```
web: npm start
```

### .railwayignore
```
node_modules
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.git
.gitignore
README.md
*.md
```
