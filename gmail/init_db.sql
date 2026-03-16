-- For production:
-- CREATE DATABASE must be run as root (e.g. postgres).
-- This script must be run as a dedicated user (e.g. gmail_addin) which has
-- the rights to create and alter tables.
-- For development:
-- CREATE DATABASE as well as this script can be run as any superuser.
-- Example:
-- createdb odoo_gmail_addin
-- psql -f init_db.sql odoo_gmail_addin

CREATE TABLE IF NOT EXISTS users_settings (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    odoo_url TEXT,
    odoo_token TEXT,
    login_token TEXT,
    login_token_expire_at TIMESTAMP WITH TIME ZONE,
    translations JSON,
    translations_expire_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    message_id TEXT NOT NULL,
    res_id INTEGER NOT NULL,
    res_model TEXT NOT NULL,
    create_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users_settings(id) ON DELETE CASCADE
);
