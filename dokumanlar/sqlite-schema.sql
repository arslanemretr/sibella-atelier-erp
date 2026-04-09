-- auth_sessions
CREATE TABLE auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

-- barcode_standards
CREATE TABLE barcode_standards (
    id TEXT PRIMARY KEY,
    name TEXT,
    prefix TEXT,
    separator TEXT,
    digits INTEGER,
    next_number INTEGER,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

-- categories
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    level1 TEXT,
    level2 TEXT,
    level3 TEXT,
    level4 TEXT,
    full_path TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

-- collections
CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

-- consignment_contracts
CREATE TABLE consignment_contracts (
    id TEXT PRIMARY KEY,
    supplier_id TEXT,
    start_date TEXT,
    end_date TEXT,
    commission_rate REAL,
    pdf_name TEXT,
    pdf_data_url TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

-- delivery_lines
CREATE TABLE delivery_lines (
    id TEXT PRIMARY KEY,
    delivery_list_id TEXT NOT NULL,
    product_id TEXT,
    is_new_product INTEGER,
    image TEXT,
    name TEXT,
    code TEXT,
    sale_price REAL,
    sale_currency TEXT,
    quantity REAL,
    description TEXT,
    sort_order INTEGER,
    FOREIGN KEY (delivery_list_id) REFERENCES delivery_lists(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

-- delivery_lists
CREATE TABLE delivery_lists (
    id TEXT PRIMARY KEY,
    delivery_no TEXT,
    supplier_id TEXT,
    supplier_name TEXT,
    contact_name TEXT,
    supplier_email TEXT,
    date TEXT,
    shipping_method TEXT,
    tracking_no TEXT,
    note TEXT,
    status TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

-- kv_store
CREATE TABLE kv_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

-- login_attempts
CREATE TABLE login_attempts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    ip_address TEXT,
    attempted_at TEXT NOT NULL,
    success INTEGER NOT NULL,
    failure_reason TEXT,
    user_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

-- password_reset_tokens
CREATE TABLE password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    requested_ip TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

-- payment_terms
CREATE TABLE payment_terms (
    id TEXT PRIMARY KEY,
    name TEXT,
    days INTEGER,
    description TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

-- pos_categories
CREATE TABLE pos_categories (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

-- pos_sale_lines
CREATE TABLE pos_sale_lines (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    product_id TEXT,
    quantity REAL,
    unit_price REAL,
    line_total REAL,
    sort_order INTEGER,
    FOREIGN KEY (sale_id) REFERENCES pos_sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

-- pos_sales
CREATE TABLE pos_sales (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    receipt_no TEXT,
    sold_at TEXT,
    customer_name TEXT,
    payment_method TEXT,
    note TEXT,
    discount_type TEXT,
    discount_value REAL,
    discount_amount REAL,
    subtotal REAL,
    tax_total REAL,
    grand_total REAL,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (session_id) REFERENCES pos_sessions(id)
  );

-- pos_sessions
CREATE TABLE pos_sessions (
    id TEXT PRIMARY KEY,
    session_no TEXT,
    register_name TEXT,
    cashier_name TEXT,
    opening_balance REAL,
    opened_at TEXT,
    closed_at TEXT,
    status TEXT,
    note TEXT,
    created_at TEXT,
    updated_at TEXT
  );

-- procurement_types
CREATE TABLE procurement_types (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  );

-- product_features
CREATE TABLE product_features (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    name TEXT,
    value TEXT,
    sort_order INTEGER,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

-- products
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT,
    sale_price REAL,
    sale_currency TEXT,
    cost REAL,
    cost_currency TEXT,
    category_id TEXT,
    collection_id TEXT,
    pos_category_id TEXT,
    supplier_id TEXT,
    barcode TEXT,
    supplier_code TEXT,
    min_stock REAL,
    supplier_lead_time REAL,
    stock REAL,
    product_type TEXT,
    sales_tax TEXT,
    image TEXT,
    is_for_sale INTEGER,
    is_for_purchase INTEGER,
    use_in_pos INTEGER,
    track_inventory INTEGER,
    status TEXT,
    workflow_status TEXT,
    created_by TEXT,
    notes TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

-- purchase_lines
CREATE TABLE purchase_lines (
    id TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL,
    product_id TEXT,
    quantity REAL,
    unit_price REAL,
    note TEXT,
    sort_order INTEGER,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

-- purchases
CREATE TABLE purchases (
    id TEXT PRIMARY KEY,
    document_no TEXT,
    supplier_id TEXT,
    date TEXT,
    procurement_type_id TEXT,
    payment_term_id TEXT,
    description TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

-- smtp_settings
CREATE TABLE smtp_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    host TEXT,
    port INTEGER,
    secure INTEGER NOT NULL DEFAULT 0,
    username TEXT,
    password TEXT,
    from_name TEXT,
    from_email TEXT,
    updated_at TEXT
  );

-- stock_entries
CREATE TABLE stock_entries (
    id TEXT PRIMARY KEY,
    document_no TEXT,
    source_party_id TEXT,
    date TEXT,
    stock_type TEXT,
    source_type TEXT,
    status TEXT,
    note TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (source_party_id) REFERENCES suppliers(id)
  );

-- stock_lines
CREATE TABLE stock_lines (
    id TEXT PRIMARY KEY,
    stock_entry_id TEXT NOT NULL,
    product_id TEXT,
    quantity REAL,
    unit_cost REAL,
    note TEXT,
    sort_order INTEGER,
    FOREIGN KEY (stock_entry_id) REFERENCES stock_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

-- store_meta
CREATE TABLE store_meta (
    key TEXT PRIMARY KEY,
    updated_at TEXT NOT NULL
  );

-- suppliers
CREATE TABLE suppliers (
    id TEXT PRIMARY KEY,
    short_code TEXT,
    company TEXT,
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
    created_at TEXT,
    updated_at TEXT
  );

-- system_parameters
CREATE TABLE system_parameters (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    product_code_control_enabled INTEGER,
    updated_at TEXT
  );

-- users
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    full_name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    supplier_id TEXT,
    status TEXT,
    last_login_at TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );
