-- SQL script to create the proxy_routes table in Supabase

CREATE TABLE proxy_routes (
    id BIGSERIAL PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    target_url TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    cost_usdc DOUBLE PRECISION DEFAULT 0,
    auth_header TEXT,
    is_test BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on path for faster lookups
CREATE INDEX idx_proxy_routes_path ON proxy_routes(path);

-- Create index on enabled for filtering
CREATE INDEX idx_proxy_routes_enabled ON proxy_routes(enabled);

-- Create trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_proxy_routes_updated_at 
    BEFORE UPDATE ON proxy_routes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Optional: Insert a default route if needed
INSERT INTO proxy_routes (path, target_url, enabled, cost_usdc, auth_header, is_test)
VALUES ('/api', 'http://localhost:3000', true, 0, NULL, true)
ON CONFLICT (path) DO NOTHING;