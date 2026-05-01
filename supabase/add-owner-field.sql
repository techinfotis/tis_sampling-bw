-- Migration: tambah field owner ke tabel users
-- Jalankan ini di Supabase SQL Editor jika tabel users sudah ada

ALTER TABLE users ADD COLUMN IF NOT EXISTS owner VARCHAR(50) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_owner ON users(owner);

-- Migration: tambah composite index untuk sessions agar sync multi-device tidak bentrok
CREATE INDEX IF NOT EXISTS idx_sessions_local_created ON sessions(local_id, created_by);
