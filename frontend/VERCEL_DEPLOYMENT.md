# Vercel Deployment Configuration

## Frontend Deployment to Vercel

### Step 1: Prepare Frontend for Vercel
1. **Build Command**: `npm run build`
2. **Output Directory**: `.next`
3. **Install Command**: `npm install`

### Step 2: Environment Variables for Vercel
Set these in Vercel dashboard → Project Settings → Environment Variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.railway.app
```

### Step 3: Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from frontend directory
cd frontend
vercel --prod
```

### Step 4: Custom Domain (Optional)
- Vercel provides free `your-project.vercel.app` domain
- Can add custom domain in Vercel dashboard

## Vercel Configuration Files

### vercel.json (Optional)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

### .vercelignore
```
node_modules
.next
.env.local
.env.development.local
.env.test.local
.env.production.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```
