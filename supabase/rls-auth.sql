-- ============================================
-- RLS dengan Supabase Auth (Opsi A)
-- Jalankan di Supabase SQL Editor
-- ============================================

-- Tambah kolom auth_uid ke tabel users untuk mapping
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid UUID DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users(auth_uid);

-- ============================================
-- DROP semua policy lama (termasuk yang baru)
-- ============================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all for anon" ON users;
  DROP POLICY IF EXISTS "Allow all for anon" ON kandangs;
  DROP POLICY IF EXISTS "Allow all for anon" ON sessions;
  DROP POLICY IF EXISTS "Allow all for anon" ON timbang;
  DROP POLICY IF EXISTS "Allow all for anon" ON audit_logs;
  DROP POLICY IF EXISTS "users_select" ON users;
  DROP POLICY IF EXISTS "users_insert" ON users;
  DROP POLICY IF EXISTS "users_update" ON users;
  DROP POLICY IF EXISTS "users_delete" ON users;
  DROP POLICY IF EXISTS "kandangs_select" ON kandangs;
  DROP POLICY IF EXISTS "kandangs_insert" ON kandangs;
  DROP POLICY IF EXISTS "kandangs_update" ON kandangs;
  DROP POLICY IF EXISTS "kandangs_delete" ON kandangs;
  DROP POLICY IF EXISTS "sessions_select" ON sessions;
  DROP POLICY IF EXISTS "sessions_insert" ON sessions;
  DROP POLICY IF EXISTS "sessions_update" ON sessions;
  DROP POLICY IF EXISTS "sessions_delete" ON sessions;
  DROP POLICY IF EXISTS "timbang_select" ON timbang;
  DROP POLICY IF EXISTS "timbang_insert" ON timbang;
  DROP POLICY IF EXISTS "timbang_delete" ON timbang;
  DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
  DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
END $$;

-- ============================================
-- Helper function: ambil username dari auth.uid()
-- ============================================
CREATE OR REPLACE FUNCTION get_my_username()
RETURNS TEXT AS $$
  SELECT username FROM users WHERE auth_uid = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: ambil role dari auth.uid()
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE auth_uid = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: ambil owner dari auth.uid()
CREATE OR REPLACE FUNCTION get_my_owner()
RETURNS TEXT AS $$
  SELECT owner FROM users WHERE auth_uid = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: cek apakah user adalah superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE auth_uid = auth.uid() AND username = 'shakadigital'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- USERS TABLE
-- Superadmin: lihat semua
-- Admin: lihat dirinya + user yang dia buat (owner = username-nya)
-- Operator: lihat dirinya saja
-- ============================================
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated USING (
  is_superadmin()
  OR auth_uid = auth.uid()
  OR owner = get_my_username()
);

CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated WITH CHECK (
  is_superadmin()
  OR get_my_role() = 'admin'
);

CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated USING (
  is_superadmin()
  OR (get_my_role() = 'admin' AND (owner = get_my_username() OR auth_uid = auth.uid()))
) WITH CHECK (
  is_superadmin()
  OR (get_my_role() = 'admin' AND (owner = get_my_username() OR auth_uid = auth.uid()))
);

CREATE POLICY "users_delete" ON users FOR DELETE TO authenticated USING (
  is_superadmin()
  OR (get_my_role() = 'admin' AND owner = get_my_username())
);

-- ============================================
-- KANDANGS TABLE
-- Superadmin: semua
-- Admin: kandang yang dia buat
-- Operator: kandang yang dibuat oleh owner-nya
-- ============================================
CREATE POLICY "kandangs_select" ON kandangs FOR SELECT TO authenticated USING (
  is_superadmin()
  OR created_by = get_my_username()
  OR created_by = get_my_owner()
);

CREATE POLICY "kandangs_insert" ON kandangs FOR INSERT TO authenticated WITH CHECK (
  is_superadmin()
  OR get_my_role() = 'admin'
  OR get_my_role() = 'operator'
);

CREATE POLICY "kandangs_update" ON kandangs FOR UPDATE TO authenticated USING (
  is_superadmin()
  OR created_by = get_my_username()
  OR created_by = get_my_owner()
);

CREATE POLICY "kandangs_delete" ON kandangs FOR DELETE TO authenticated USING (
  is_superadmin()
  OR (get_my_role() = 'admin' AND created_by = get_my_username())
);

-- ============================================
-- SESSIONS TABLE
-- ============================================
CREATE POLICY "sessions_select" ON sessions FOR SELECT TO authenticated USING (
  is_superadmin()
  OR created_by = get_my_username()
  OR created_by IN (
    SELECT username FROM users WHERE owner = get_my_username()
  )
  OR (
    get_my_owner() IS NOT NULL AND created_by IN (
      SELECT username FROM users WHERE username = get_my_owner() OR owner = get_my_owner()
    )
  )
);

CREATE POLICY "sessions_insert" ON sessions FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY "sessions_update" ON sessions FOR UPDATE TO authenticated USING (
  is_superadmin()
  OR created_by = get_my_username()
);

CREATE POLICY "sessions_delete" ON sessions FOR DELETE TO authenticated USING (
  is_superadmin()
  OR created_by = get_my_username()
);

-- ============================================
-- TIMBANG TABLE
-- Akses via session_id yang sudah difilter
-- ============================================
CREATE POLICY "timbang_select" ON timbang FOR SELECT TO authenticated USING (
  is_superadmin()
  OR session_id IN (
    SELECT id FROM sessions WHERE
      created_by = get_my_username()
      OR created_by IN (SELECT username FROM users WHERE owner = get_my_username())
      OR (
        get_my_owner() IS NOT NULL AND created_by IN (
          SELECT username FROM users WHERE username = get_my_owner() OR owner = get_my_owner()
        )
      )
  )
);

CREATE POLICY "timbang_insert" ON timbang FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY "timbang_delete" ON timbang FOR DELETE TO authenticated USING (
  is_superadmin()
  OR session_id IN (
    SELECT id FROM sessions WHERE created_by = get_my_username()
  )
);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated USING (
  is_superadmin()
  OR username = get_my_username()
  OR username IN (SELECT username FROM users WHERE owner = get_my_username())
);

CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IS NOT NULL
);

-- ============================================
-- Proteksi field owner via trigger
-- Mencegah owner diubah setelah di-set
-- ============================================
CREATE OR REPLACE FUNCTION protect_owner_field()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika owner sudah di-set, tidak boleh diubah kecuali oleh superadmin
  IF OLD.owner IS NOT NULL AND NEW.owner != OLD.owner THEN
    IF NOT is_superadmin() THEN
      RAISE EXCEPTION 'Field owner tidak dapat diubah';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_owner ON users;
CREATE TRIGGER trg_protect_owner
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION protect_owner_field();

-- ============================================
-- Proteksi akun superadmin & demo dari DELETE
-- ============================================
CREATE OR REPLACE FUNCTION protect_system_accounts()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.username IN ('shakadigital', 'admin', 'operator') THEN
    RAISE EXCEPTION 'Akun sistem tidak dapat dihapus';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_system_accounts ON users;
CREATE TRIGGER trg_protect_system_accounts
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION protect_system_accounts();
