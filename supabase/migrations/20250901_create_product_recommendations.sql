-- Product recommendations storage for daily admin suggestions

-- Table to store daily recommendations per type
CREATE TABLE IF NOT EXISTS product_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deals', 'best_sellers')),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score DECIMAL(10,4) NOT NULL DEFAULT 0,
  reason JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (date, type, product_id)
);

-- Helpful index for querying today's recommendations
CREATE INDEX IF NOT EXISTS idx_product_recommendations_date_type
  ON product_recommendations (date DESC, type);

-- Optional run log
CREATE TABLE IF NOT EXISTS product_recommendation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('deals', 'best_sellers', 'both')),
  algorithm_version TEXT DEFAULT 'v1',
  products_count INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (read-only for authenticated, write by service role)
ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recommendation_runs ENABLE ROW LEVEL SECURITY;

-- Read for authenticated users (admin UI uses service role on server, but keep safe)
CREATE POLICY IF NOT EXISTS "Authenticated can read product recommendations"
  ON product_recommendations FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Authenticated can read recommendation runs"
  ON product_recommendation_runs FOR SELECT USING (auth.role() = 'authenticated');

-- Service role will handle inserts/updates; no public write policies.

