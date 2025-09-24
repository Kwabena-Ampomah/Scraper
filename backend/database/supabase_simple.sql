-- Simple Supabase Vector Setup (Minimal Version)
-- Run this in your Supabase SQL editor for quick setup

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
