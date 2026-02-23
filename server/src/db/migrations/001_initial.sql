CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id),
  include_in_expense_analytics INTEGER NOT NULL DEFAULT 1,
  include_in_income_analytics INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  source_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  rows_need_review INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date_time TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('expense','income','transfer','ignore')),
  amount_kopeks INTEGER NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  description TEXT,
  merchant_norm TEXT,
  mcc TEXT,
  bank_category_raw TEXT,
  import_batch_id INTEGER REFERENCES import_batches(id),
  fingerprint TEXT UNIQUE,
  tags TEXT
);

CREATE TABLE transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  from_tag TEXT,
  to_tag TEXT
);

CREATE TABLE rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  match_type TEXT NOT NULL CHECK(match_type IN ('contains','startsWith','regex','equals')),
  pattern TEXT NOT NULL,
  mcc TEXT,
  bank_category_raw TEXT,
  amount_sign TEXT CHECK(amount_sign IN ('positive','negative',NULL)),
  action_type TEXT NOT NULL CHECK(action_type IN ('categorize','set_type','ignore')),
  action_category_id INTEGER REFERENCES categories(id),
  action_set_type TEXT CHECK(action_set_type IN ('expense','income','transfer','ignore',NULL)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  priority INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date_time);
CREATE INDEX idx_transactions_fingerprint ON transactions(fingerprint);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_rules_user ON rules(user_id);
