# Supabase Database Setup

## Free Tier Database Configuration

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create new project
4. Choose free tier
5. Note your project URL and API keys

### Step 2: Run Database Schema
1. Go to SQL Editor in Supabase dashboard
2. Run the schema creation script:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS public.embeddings (
    id BIGSERIAL PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'post',
    content_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (content_id, content_type)
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_embeddings_content_id ON public.embeddings(content_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine ON public.embeddings USING hnsw (embedding vector_cosine_ops);

-- Grant permissions
GRANT ALL ON public.embeddings TO authenticated;
GRANT ALL ON public.embeddings TO service_role;
GRANT USAGE ON SEQUENCE public.embeddings_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.embeddings_id_seq TO service_role;

-- Verify setup
SELECT 'Supabase embeddings table created successfully!' as status;
```

### Step 3: Get Connection Details
From Supabase dashboard → Settings → Database:

```env
# Database Connection
DB_HOST=db.your-project.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-database-password
DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Supabase API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 4: Test Connection
```bash
# Test database connection
psql "postgresql://postgres:password@db.your-project.supabase.co:5432/postgres"

# Test API connection
curl -H "apikey: your-anon-key" \
     -H "Authorization: Bearer your-anon-key" \
     "https://your-project.supabase.co/rest/v1/embeddings"
```

## Free Tier Limits

### Supabase Free Tier
- **Database**: 500MB storage
- **Bandwidth**: 2GB/month
- **API Requests**: 50,000/month
- **Auth Users**: 50,000
- **Edge Functions**: 500,000 invocations/month

### Usage Monitoring
- Monitor usage in Supabase dashboard
- Set up alerts for approaching limits
- Consider upgrading if needed

## Security Best Practices

### Row Level Security (RLS)
```sql
-- Enable RLS on embeddings table
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;

-- Create policy for service role
CREATE POLICY "Service role can do everything" ON public.embeddings
FOR ALL USING (auth.role() = 'service_role');

-- Create policy for authenticated users
CREATE POLICY "Authenticated users can read" ON public.embeddings
FOR SELECT USING (auth.role() = 'authenticated');
```

### API Key Security
- Use service role key only in backend
- Use anon key in frontend
- Never expose service role key in client code
- Rotate keys regularly