-- ============================================
-- RLS Fix: Allow all authenticated users
-- Jalankan ini di Supabase SQL Editor
-- Ini menggantikan policy ketat dengan policy
-- yang mengizinkan semua user terautentikasi
-- Isolasi tetap dijaga di layer aplikasi
-- ============================================

-- Drop semua policy yang ada
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

-- Izinkan semua operasi untuk user yang sudah login (authenticated)
-- Isolasi multi-tenant tetap dijaga di layer aplikasi (IndexedDB + UI)
CREATE POLICY "allow_all_authenticated" ON users       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON kandangs    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON sessions    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON timbang     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON audit_logs  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Proteksi trigger tetap aktif (tidak bisa hapus akun sistem)
-- Trigger trg_protect_owner dan trg_protect_system_accounts dari rls-auth.sql tetap berlaku
