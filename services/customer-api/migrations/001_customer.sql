CREATE TABLE IF NOT EXISTS profiles (
  sub uuid PRIMARY KEY,
  display_name text NOT NULL,
  region_id text NOT NULL,
  location jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  order_id text PRIMARY KEY,
  owner_sub uuid NOT NULL REFERENCES profiles(sub),
  region_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','completed','cancelled')),
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  lines jsonb NOT NULL,
  total_copper bigint NOT NULL CHECK (total_copper >= 0),
  checkout_key text NOT NULL,
  request_hash text,
  UNIQUE (owner_sub, checkout_key)
);
CREATE INDEX IF NOT EXISTS orders_owner_newest ON orders(owner_sub, created_at DESC, order_id DESC);
CREATE INDEX IF NOT EXISTS orders_newest ON orders(created_at DESC, order_id DESC);
CREATE INDEX IF NOT EXISTS orders_region_created ON orders(region_id, created_at DESC);
CREATE TABLE IF NOT EXISTS widget_layouts (owner_sub uuid PRIMARY KEY REFERENCES profiles(sub), widget_ids jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS dataset_meta (singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), revision bigint NOT NULL);
INSERT INTO dataset_meta(singleton, revision) VALUES (true, 1) ON CONFLICT DO NOTHING;
