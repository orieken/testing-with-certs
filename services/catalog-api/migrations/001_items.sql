CREATE TABLE IF NOT EXISTS items (
 id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
 name text NOT NULL,
 description text NOT NULL,
 rarity text NOT NULL,
 image text NOT NULL,
 price_copper bigint NOT NULL CHECK (price_copper BETWEEN 0 AND 9007199254740991),
 category_id text,
 display_stock integer CHECK (display_stock BETWEEN 0 AND 1000000),
 active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS items_active_id ON items (id) WHERE active;
