-- ============================================
-- Smart Farm Layer 4.0 - Supabase Schema
-- Safe to re-run (idempotent)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nama VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  owner VARCHAR(50) DEFAULT NULL,  -- username admin yang membuat user ini (NULL = superadmin/independent)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kandangs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode VARCHAR(10) UNIQUE NOT NULL,
  nama VARCHAR(100) NOT NULL,
  penanggung_jawab VARCHAR(100) NOT NULL,
  kontak VARCHAR(50) NOT NULL,
  kapasitas INTEGER,
  chick_in_date DATE DEFAULT NULL,
  chick_in_age INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(50),
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INTEGER,
  kandang VARCHAR(10) NOT NULL,
  umur_mg INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(50),
  synced BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS timbang (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INTEGER,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  id_ayam INTEGER NOT NULL,
  berat INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id INTEGER,
  user_id VARCHAR(50),
  username VARCHAR(50) NOT NULL,
  nama VARCHAR(100) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type VARCHAR(50) NOT NULL,
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEFAULT USERS
-- ============================================

INSERT INTO users (username, password, nama, role)
VALUES
  ('shakadigital', 'abrisam2554', 'Shaka Digital', 'admin'),
  ('admin', 'admin123', 'Administrator', 'admin'),
  ('operator', 'operator123', 'Operator', 'operator')
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- RLS
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kandangs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE timbang ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop dulu jika sudah ada, baru buat ulang
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all for anon" ON users;
  DROP POLICY IF EXISTS "Allow all for anon" ON kandangs;
  DROP POLICY IF EXISTS "Allow all for anon" ON sessions;
  DROP POLICY IF EXISTS "Allow all for anon" ON timbang;
  DROP POLICY IF EXISTS "Allow all for anon" ON audit_logs;
END $$;

CREATE POLICY "Allow all for anon" ON users       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON kandangs    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON sessions    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON timbang     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON audit_logs  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sessions_kandang       ON sessions(kandang);
CREATE INDEX IF NOT EXISTS idx_sessions_local_created  ON sessions(local_id, created_by);
CREATE INDEX IF NOT EXISTS idx_timbang_session_id      ON timbang(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts           ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity       ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_users_owner             ON users(owner);

-- ============================================
-- MIGRATION (untuk database yang sudah ada)
-- Aman dijalankan ulang karena pakai IF NOT EXISTS / IF NOT EXISTS
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS owner VARCHAR(50) DEFAULT NULL;

-- Migration: tambah field chick_in_date dan chick_in_age ke kandangs
ALTER TABLE kandangs ADD COLUMN IF NOT EXISTS chick_in_date DATE DEFAULT NULL;
ALTER TABLE kandangs ADD COLUMN IF NOT EXISTS chick_in_age INTEGER DEFAULT 0;
