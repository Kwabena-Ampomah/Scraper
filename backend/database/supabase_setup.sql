-- Supabase Vector Database Setup Script
-- This script creates the embeddings table with pgvector extension
-- Run this in your Supabase SQL editor

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the embeddings table
CREATE TABLE IF NOT EXISTS public.embeddings (
    id BIGSERIAL PRIMARY KEY,
    content_id TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'post',
    content_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL, -- OpenAI text-embedding-ada-002 has 1536 dimensions
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT embeddings_content_id_type_unique UNIQUE (content_id, content_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_embeddings_content_id ON public.embeddings(content_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_type ON public.embeddings(content_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON public.embeddings(created_at);

-- Create vector similarity index for fast similarity search
-- This uses HNSW (Hierarchical Navigable Small World) algorithm
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine 
ON public.embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create vector similarity index for L2 distance
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_l2 
ON public.embeddings 
USING hnsw (embedding vector_l2_ops)
WITH (m = 16, ef_construction = 64);

-- Create vector similarity index for inner product
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_ip 
ON public.embeddings 
USING hnsw (embedding vector_ip_ops)
WITH (m = 16, ef_construction = 64);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_embeddings_updated_at 
    BEFORE UPDATE ON public.embeddings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust based on your Supabase setup)
-- These might already be set by Supabase, but including for completeness
GRANT ALL ON public.embeddings TO authenticated;
GRANT ALL ON public.embeddings TO service_role;
GRANT USAGE ON SEQUENCE public.embeddings_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.embeddings_id_seq TO service_role;

-- Create a view for easy querying with similarity scores
CREATE OR REPLACE VIEW public.embeddings_with_similarity AS
SELECT 
    id,
    content_id,
    content_type,
    content_text,
    embedding,
    metadata,
    created_at,
    updated_at,
    -- Add similarity calculation functions
    (embedding <=> (SELECT embedding FROM public.embeddings LIMIT 1)) as cosine_distance,
    (embedding <#> (SELECT embedding FROM public.embeddings LIMIT 1)) as negative_inner_product,
    (embedding <-> (SELECT embedding FROM public.embeddings LIMIT 1)) as l2_distance
FROM public.embeddings;

-- Grant permissions on the view
GRANT SELECT ON public.embeddings_with_similarity TO authenticated;
GRANT SELECT ON public.embeddings_with_similarity TO service_role;

-- Create a function for similarity search
CREATE OR REPLACE FUNCTION public.search_similar_embeddings(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    content_type_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    content_id TEXT,
    content_type TEXT,
    content_text TEXT,
    metadata JSONB,
    similarity FLOAT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
AS $$
    SELECT 
        e.id,
        e.content_id,
        e.content_type,
        e.content_text,
        e.metadata,
        1 - (e.embedding <=> query_embedding) as similarity,
        e.created_at
    FROM public.embeddings e
    WHERE 
        (content_type_filter IS NULL OR e.content_type = content_type_filter)
        AND 1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.search_similar_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_similar_embeddings TO service_role;

-- Insert some test data (optional - remove if you don't want test data)
-- This creates a simple test embedding for verification
INSERT INTO public.embeddings (content_id, content_type, content_text, embedding, metadata)
VALUES (
    'test-001',
    'post',
    'This is a test post about WHOOP 5.0 features',
    array_fill(0.1, ARRAY[1536])::vector(1536), -- Creates a vector of 1536 dimensions filled with 0.1
    '{"title": "Test Post", "author": "test", "platform": "test"}'
) ON CONFLICT (content_id, content_type) DO NOTHING;

-- Verify the setup
SELECT 
    'Setup completed successfully!' as status,
    COUNT(*) as total_embeddings,
    pg_size_pretty(pg_total_relation_size('public.embeddings')) as table_size
FROM public.embeddings;
