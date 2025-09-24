# 🚀 CORS & Deployment Fix Guide

## 🎯 **THE PROBLEM:**
Your Vercel-deployed frontend is trying to call `localhost:3001`, which doesn't exist from the internet.

## 🔧 **SOLUTION OPTIONS:**

### **Option 1: Deploy Backend to Railway (Recommended)**

#### **Step 1: Deploy Backend**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway (opens browser)
railway login

# Initialize project
cd backend
railway init

# Deploy
railway up
```

#### **Step 2: Get Railway URL**
After deployment, Railway will give you a URL like:
`https://your-project-name.railway.app`

#### **Step 3: Update Vercel Environment Variables**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `NEXT_PUBLIC_API_BASE_URL` = `https://your-project-name.railway.app`
3. Redeploy frontend

### **Option 2: Use ngrok for Local Development (Quick Fix)**

#### **Step 1: Install ngrok**
```bash
# Install ngrok
brew install ngrok

# Or download from https://ngrok.com/
```

#### **Step 2: Expose Local Backend**
```bash
# Start your backend
cd backend
PORT=3001 node server.js

# In another terminal, expose it
ngrok http 3001
```

#### **Step 3: Update Frontend**
ngrok will give you a URL like: `https://abc123.ngrok.io`
Update your frontend to use this URL.

### **Option 3: Fix Environment Variables (Production Ready)**

#### **Step 1: Update Frontend API Configuration**
```typescript
// frontend/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'
```

#### **Step 2: Set Vercel Environment Variables**
1. Go to Vercel Dashboard
2. Project Settings → Environment Variables
3. Add: `NEXT_PUBLIC_API_BASE_URL` = `https://your-backend-url.com`

#### **Step 3: Redeploy Frontend**
```bash
vercel --prod
```

## 🚀 **RECOMMENDED APPROACH:**

### **For Production: Deploy Backend to Railway**

1. **Deploy Backend:**
   ```bash
   cd backend
   railway login
   railway init
   railway up
   ```

2. **Set Environment Variables in Railway:**
   ```env
   NODE_ENV=production
   DB_HOST=your-supabase-host
   DB_PASSWORD=your-supabase-password
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-key
   OPENAI_API_KEY=your-openai-key
   ```

3. **Update Vercel Environment:**
   - Add `NEXT_PUBLIC_API_BASE_URL` = `https://your-railway-url.railway.app`

4. **Redeploy Frontend:**
   ```bash
   vercel --prod
   ```

## 🔧 **CORS Configuration (Already Fixed)**

Your backend CORS is already configured correctly:
```javascript
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## 📋 **Environment Variables Needed:**

### **Railway Backend:**
```env
NODE_ENV=production
PORT=3001
DB_HOST=your-supabase-host
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-supabase-password
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
```

### **Vercel Frontend:**
```env
NEXT_PUBLIC_API_BASE_URL=https://your-railway-url.railway.app
```

## 🎯 **QUICK TEST:**

After deployment, test with:
```bash
curl https://your-railway-url.railway.app/api/health
```

Should return:
```json
{"status":"healthy","timestamp":"...","version":"1.0.0"}
```

## 🚨 **TROUBLESHOOTING:**

### **CORS Errors:**
- Check that `origin: true` is set in backend CORS
- Verify frontend is using correct API URL

### **Network Errors:**
- Ensure backend is deployed and accessible
- Check environment variables are set correctly
- Verify API endpoints are working with curl

### **Environment Variable Issues:**
- Make sure `NEXT_PUBLIC_` prefix is used for client-side variables
- Redeploy frontend after changing environment variables
