-- Add subreddit column to products table for mapping
ALTER TABLE products ADD COLUMN IF NOT EXISTS subreddit VARCHAR(100);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_subreddit ON products(subreddit);

-- Insert sample product data with subreddit mappings
INSERT INTO companies (name, domain, industry) 
VALUES ('WHOOP Inc.', 'whoop.com', 'Fitness Technology') 
ON CONFLICT (name) DO NOTHING;

INSERT INTO companies (name, domain, industry) 
VALUES ('Apple Inc.', 'apple.com', 'Consumer Electronics') 
ON CONFLICT (name) DO NOTHING;

-- Insert products with subreddit mappings
INSERT INTO products (company_id, name, version, description, subreddit) 
SELECT c.id, 'WHOOP 5.0', '5.0', 'Advanced fitness and health monitoring wearable device', 'whoop'
FROM companies c WHERE c.name = 'WHOOP Inc.'
ON CONFLICT (name, version) DO UPDATE SET subreddit = EXCLUDED.subreddit;

INSERT INTO products (company_id, name, version, description, subreddit) 
SELECT c.id, 'Apple Watch', 'Series 9', 'Smart fitness and health tracking watch', 'AppleWatch'
FROM companies c WHERE c.name = 'Apple Inc.'
ON CONFLICT (name, version) DO UPDATE SET subreddit = EXCLUDED.subreddit;
