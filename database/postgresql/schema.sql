CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  level1 TEXT,
  level2 TEXT,
  level3 TEXT,
  level4 TEXT,
  full_path TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pos_categories (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS barcode_standards (
  id TEXT PRIMARY KEY,
  name TEXT,
  prefix TEXT,
  separator TEXT,
  digits INTEGER,
  next_number INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS procurement_types (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payment_terms (
  id TEXT PRIMARY KEY,
  name TEXT,
  days INTEGER,
  description TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  short_code TEXT,
  company TEXT,
  logo TEXT,
  contact TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  iban TEXT,
  tax_number TEXT,
  tax_office TEXT,
  address TEXT,
  procurement_type_id TEXT,
  payment_term_id TEXT,
  status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS logo TEXT;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  role TEXT,
  supplier_id TEXT REFERENCES suppliers(id),
  status TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT,
  sale_price DOUBLE PRECISION,
  sale_currency TEXT,
  cost DOUBLE PRECISION,
  cost_currency TEXT,
  category_id TEXT REFERENCES categories(id),
  collection_id TEXT REFERENCES collections(id),
  pos_category_id TEXT REFERENCES pos_categories(id),
  supplier_id TEXT REFERENCES suppliers(id),
  barcode TEXT,
  supplier_code TEXT,
  min_stock DOUBLE PRECISION,
  supplier_lead_time DOUBLE PRECISION,
  stock DOUBLE PRECISION,
  product_type TEXT,
  sales_tax TEXT,
  image TEXT,
  is_for_sale BOOLEAN,
  is_for_purchase BOOLEAN,
  use_in_pos BOOLEAN,
  track_inventory BOOLEAN,
  status TEXT,
  workflow_status TEXT,
  shopify_product_gid TEXT,
  created_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS shopify_product_gid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_shopify_product_gid_idx
  ON products (shopify_product_gid)
  WHERE shopify_product_gid IS NOT NULL;

CREATE TABLE IF NOT EXISTS product_features (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT,
  value TEXT,
  sort_order INTEGER
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  document_no TEXT,
  supplier_id TEXT REFERENCES suppliers(id),
  date DATE,
  procurement_type_id TEXT,
  payment_term_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS purchase_lines (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  quantity DOUBLE PRECISION,
  unit_price DOUBLE PRECISION,
  note TEXT,
  sort_order INTEGER
);

CREATE TABLE IF NOT EXISTS consignment_contracts (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers(id),
  start_date DATE,
  end_date DATE,
  commission_rate DOUBLE PRECISION,
  pdf_name TEXT,
  pdf_data_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_entries (
  id TEXT PRIMARY KEY,
  document_no TEXT,
  source_party_id TEXT REFERENCES suppliers(id),
  date DATE,
  stock_type TEXT,
  source_type TEXT,
  status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_lines (
  id TEXT PRIMARY KEY,
  stock_entry_id TEXT NOT NULL REFERENCES stock_entries(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  quantity DOUBLE PRECISION,
  unit_cost DOUBLE PRECISION,
  note TEXT,
  sort_order INTEGER
);

CREATE TABLE IF NOT EXISTS pos_sessions (
  id TEXT PRIMARY KEY,
  session_no TEXT,
  register_name TEXT,
  cashier_name TEXT,
  opening_balance DOUBLE PRECISION,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pos_sales (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES pos_sessions(id),
  receipt_no TEXT,
  sold_at TIMESTAMPTZ,
  customer_name TEXT,
  payment_method TEXT,
  note TEXT,
  discount_type TEXT,
  discount_value DOUBLE PRECISION,
  discount_amount DOUBLE PRECISION,
  subtotal DOUBLE PRECISION,
  tax_total DOUBLE PRECISION,
  grand_total DOUBLE PRECISION,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pos_sale_lines (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  quantity DOUBLE PRECISION,
  unit_price DOUBLE PRECISION,
  line_total DOUBLE PRECISION,
  sort_order INTEGER
);

CREATE TABLE IF NOT EXISTS delivery_lists (
  id TEXT PRIMARY KEY,
  delivery_no TEXT,
  supplier_id TEXT REFERENCES suppliers(id),
  supplier_name TEXT,
  contact_name TEXT,
  supplier_email TEXT,
  date DATE,
  shipping_method TEXT,
  tracking_no TEXT,
  note TEXT,
  status TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS delivery_lines (
  id TEXT PRIMARY KEY,
  delivery_list_id TEXT NOT NULL REFERENCES delivery_lists(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  is_new_product BOOLEAN,
  image TEXT,
  name TEXT,
  code TEXT,
  sale_price DOUBLE PRECISION,
  sale_currency TEXT,
  quantity DOUBLE PRECISION,
  description TEXT,
  sort_order INTEGER
);

ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS delivery_list_id TEXT;
ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS category_label TEXT;
ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS collection_id TEXT;
ALTER TABLE delivery_lines ADD COLUMN IF NOT EXISTS collection_label TEXT;

CREATE TABLE IF NOT EXISTS stock_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  store_id TEXT,
  is_default_main BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_locations_single_main_idx
  ON stock_locations (is_default_main)
  WHERE is_default_main = TRUE;

CREATE TABLE IF NOT EXISTS stock_location_balances (
  stock_location_id TEXT NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (stock_location_id, product_id)
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tax_number TEXT,
  commission_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  stock_location_id TEXT NOT NULL UNIQUE REFERENCES stock_locations(id),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS store_shipments (
  id TEXT PRIMARY KEY,
  shipment_no TEXT NOT NULL UNIQUE,
  store_id TEXT NOT NULL REFERENCES stores(id),
  store_name TEXT,
  date DATE,
  shipping_method TEXT,
  tracking_no TEXT,
  note TEXT,
  status TEXT,
  created_by TEXT REFERENCES users(id),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS store_shipment_lines (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES store_shipments(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  is_manual_product BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  name TEXT,
  code TEXT,
  sale_price DOUBLE PRECISION,
  sale_currency TEXT,
  quantity DOUBLE PRECISION,
  description TEXT,
  sort_order INTEGER
);

CREATE TABLE IF NOT EXISTS system_parameters (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  product_code_control_enabled BOOLEAN,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS smtp_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  host TEXT,
  port INTEGER,
  secure BOOLEAN NOT NULL DEFAULT FALSE,
  username TEXT,
  password TEXT,
  from_name TEXT,
  from_email TEXT,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  ip_address TEXT
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  requested_ip TEXT
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMPTZ NOT NULL,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
