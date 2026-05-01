-- ============================================
-- Panduan Migrasi ke Supabase Auth
-- ============================================
-- 
-- Jalankan file ini SETELAH rls-auth.sql
--
-- LANGKAH 1: Jalankan rls-auth.sql terlebih dahulu
--
-- LANGKAH 2: Di Supabase Dashboard → Authentication → Settings:
--   - Disable "Enable email confirmations" (matikan konfirmasi email)
--   - Disable "Enable email change confirmations"
--
-- LANGKAH 3: Akun yang sudah ada (shakadigital, admin, operator)
--   akan otomatis didaftarkan ke Supabase Auth saat pertama kali login.
--   Tidak perlu migrasi manual.
--
-- LANGKAH 4: Akun baru yang dibuat admin akan langsung terdaftar
--   ke Supabase Auth secara otomatis.
--
-- ============================================
-- CEK STATUS MIGRASI
-- Jalankan query ini untuk melihat user mana yang sudah punya auth_uid
-- ============================================

SELECT 
  username,
  nama,
  role,
  owner,
  CASE WHEN auth_uid IS NOT NULL THEN '✓ Terdaftar' ELSE '✗ Belum' END AS auth_status
FROM users
ORDER BY role, username;
