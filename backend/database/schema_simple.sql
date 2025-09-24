-- Database schema for User Feedback Intelligence Platform (Simplified)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table for authentication and user management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- user, admin, pm, ux_researcher, marketing, cx
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    industry VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platforms table (Reddit, Twitter, etc.)
CREATE TABLE platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL, -- reddit, twitter, facebook, etc.
    api_endpoint VARCHAR(500),
    rate_limit_per_hour INTEGER DEFAULT 1000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Posts table for storing scraped content
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    external_id VARCHAR(255) NOT NULL, -- Reddit post ID, Twitter tweet ID, etc.
    title TEXT,
    content TEXT NOT NULL,
    author VARCHAR(255),
    url VARCHAR(1000),
    score INTEGER DEFAULT 0, -- Reddit upvotes, Twitter likes, etc.
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform_id, external_id)
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(255),
    score INTEGER DEFAULT 0,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, external_id)
);

-- Sentiment analysis results
CREATE TABLE sentiment_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL, -- Can reference posts or comments
    content_type VARCHAR(20) NOT NULL, -- 'post' or 'comment'
    sentiment_score DECIMAL(3,2) NOT NULL, -- -1.0 to 1.0
    sentiment_label VARCHAR(20) NOT NULL, -- positive, negative, neutral
    confidence DECIMAL(3,2) NOT NULL, -- 0.0 to 1.0
    emotions JSONB, -- Detailed emotion breakdown
    keywords TEXT[], -- Extracted keywords
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(50) DEFAULT 'v1.0'
);

-- Vector embeddings for semantic search (simplified - storing as JSONB for now)
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL,
    embedding JSONB, -- Store as JSONB array for now
    model VARCHAR(50) DEFAULT 'text-embedding-ada-002',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insights and themes
CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL, -- complaint, praise, trend, feature_request
    title VARCHAR(255) NOT NULL,
    description TEXT,
    sentiment_summary JSONB, -- Aggregated sentiment data
    content_count INTEGER DEFAULT 0,
    confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scraping jobs and status
CREATE TABLE scraping_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    search_terms TEXT[] NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
    posts_scraped INTEGER DEFAULT 0,
    comments_scraped INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_posts_platform_product ON posts(platform_id, product_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_sentiment_content ON sentiment_analysis(content_id, content_type);
CREATE INDEX idx_sentiment_score ON sentiment_analysis(sentiment_score);
CREATE INDEX idx_embeddings_content ON embeddings(content_id, content_type);
CREATE INDEX idx_insights_product ON insights(product_id);
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);

-- Full-text search indexes
CREATE INDEX idx_posts_content_fts ON posts USING gin(to_tsvector('english', content));
CREATE INDEX idx_comments_content_fts ON comments USING gin(to_tsvector('english', content));

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_insights_updated_at BEFORE UPDATE ON insights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW post_sentiment_summary AS
SELECT 
    p.id,
    p.title,
    p.content,
    p.author,
    p.score,
    p.created_at,
    sa.sentiment_score,
    sa.sentiment_label,
    sa.confidence,
    pr.name as product_name,
    pl.name as platform_name
FROM posts p
LEFT JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
LEFT JOIN products pr ON p.product_id = pr.id
LEFT JOIN platforms pl ON p.platform_id = pl.id;

CREATE VIEW comment_sentiment_summary AS
SELECT 
    c.id,
    c.content,
    c.author,
    c.score,
    c.created_at,
    sa.sentiment_score,
    sa.sentiment_label,
    sa.confidence,
    p.title as post_title,
    pr.name as product_name,
    pl.name as platform_name
FROM comments c
LEFT JOIN sentiment_analysis sa ON c.id = sa.content_id AND sa.content_type = 'comment'
LEFT JOIN posts p ON c.post_id = p.id
LEFT JOIN products pr ON p.product_id = pr.id
LEFT JOIN platforms pl ON p.platform_id = pl.id;

-- Insert default platforms
INSERT INTO platforms (name, api_endpoint, rate_limit_per_hour) VALUES 
('reddit', 'https://www.reddit.com', 60),
('twitter', 'https://api.twitter.com/2', 300);

-- Insert a sample company and product for testing
INSERT INTO companies (name, domain, industry) VALUES 
('WHOOP', 'whoop.com', 'Fitness Technology');

INSERT INTO products (company_id, name, version, description) VALUES 
((SELECT id FROM companies WHERE name = 'WHOOP'), 'WHOOP 5.0', '5.0', 'Advanced fitness tracking device with sleep monitoring');
