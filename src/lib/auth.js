import { db } from './db';
import { signInUser, signOutUser, signUpUser } from './supabase';

// Superadmin — akses tertinggi, tidak bisa dihapus/diedit siapapun
const SUPERADMIN = { username: 'shakadigital', password: 'abrisam2554' };

// Akun demo bawaan — bisa login tapi hanya lihat data demo
const DEMO_ACCOUNTS = [
  { username: 'admin',    password: 'admin123' },
  { username: 'operator', password: 'operator123' }
];

// Username yang dilindungi — tidak bisa dihapus atau diedit oleh siapapun
export const PROTECTED_USERNAMES = ['shakadigital', 'admin', 'operator'];

let currentUser = null;

export function getCurrentUser() {
  if (!currentUser) {
    const stored = localStorage.getItem('currentUser');
    if (stored) currentUser = JSON.parse(stored);
  }
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
  if (user) localStorage.setItem('currentUser', JSON.stringify(user));
  else localStorage.removeItem('currentUser');
}

export function isAdmin() {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

export function isSuperAdmin() {
  const user = getCurrentUser();
  return user?.username === SUPERADMIN.username;
}

export function isDemoAccount() {
  const user = getCurrentUser();
  if (!user) return false;
  return DEMO_ACCOUNTS.some(d => d.username === user.username);
}

// Hanya superadmin dan admin resmi (non-demo) yang bisa kelola user
export function canManageUsers() {
  if (isSuperAdmin()) return true;
  return isAdmin() && !isDemoAccount();
}

// Hanya admin resmi dan superadmin yang bisa hapus
export function canDelete() {
  return isAdmin() && !isDemoAccount();
}

// Dapatkan "scope" user saat ini untuk filter data
// superadmin → null (lihat semua)
// admin resmi → username admin itu sendiri
// operator dengan owner → username owner-nya
// operator tanpa owner → null (lihat semua, fallback aman)
export function getDataScope() {
  const user = getCurrentUser();
  if (!user || isDemoAccount()) return null;
  if (isSuperAdmin()) return null;
  if (user.role === 'admin') return user.username;
  return user.owner || null;
}

export async function login(username, password) {
  // ── 0. Cek apakah Superadmin ─────────────────────────────────────
  if (username === SUPERADMIN.username && password === SUPERADMIN.password) {
    // Pastikan superadmin ada di IndexedDB agar relasi data (created_by) tidak pecah
    let localUser = await db.users.where('username').equals(username).first();
    if (!localUser) {
      const id = await db.users.add({
        username: SUPERADMIN.username,
        password: SUPERADMIN.password,
        nama: 'Super Admin',
        role: 'admin',
        created_at: new Date().toISOString(),
        synced: false
      });
      localUser = await db.users.get(id);
    }
    return _doLogin(localUser, password);
  }

  // ── 1. Cek apakah akun demo ──────────────────────────────────────
  const isDemo = DEMO_ACCOUNTS.some(
    d => d.username === username && d.password === password
  );

  if (isDemo) {
    // Demo: cukup validasi lokal, tidak perlu Supabase Auth
    const user = await db.users.where('username').equals(username).first();
    if (!user) throw new Error('Username tidak ditemukan');
    if (user.password !== password) throw new Error('Password salah');

    const userData = {
      id: user.id,
      username: user.username,
      nama: user.nama,
      role: user.role,
      isDemo: true,
      isSuperAdmin: false,
      owner: user.owner || null
    };
    setCurrentUser(userData);
    return userData;
  }

  // ── 2. Validasi user ada di IndexedDB dulu ───────────────────────
  const localUser = await db.users.where('username').equals(username).first();
  if (!localUser) {
    // Coba pull dari Supabase jika online (user mungkin baru dibuat di device lain)
    if (navigator.onLine) {
      const { pullFromSupabase } = await import('./sync');
      await pullFromSupabase();
      const retryUser = await db.users.where('username').equals(username).first();
      if (!retryUser) throw new Error('Username tidak ditemukan');
      return _doLogin(retryUser, password);
    }
    throw new Error('Username tidak ditemukan');
  }

  return _doLogin(localUser, password);
}

// Internal: lakukan login setelah user ditemukan di IndexedDB
async function _doLogin(localUser, password) {
  // Validasi password lokal dulu (untuk offline support)
  if (localUser.password !== password) throw new Error('Password salah');

  const isSA = localUser.username === SUPERADMIN.username;

  // ── 3. Login ke Supabase Auth dulu, baru pull/push ───────────────
  if (navigator.onLine) {
    let authSuccess = false;
    try {
      const authUser = await signInUser(localUser.username, password);
      authSuccess = true;

      // Simpan auth_uid ke IndexedDB jika belum ada
      if (authUser && !localUser.auth_uid) {
        await db.users.update(localUser.id, { auth_uid: authUser.id, synced: false });
        // Update auth_uid di Supabase juga
        const { supabase } = await import('./supabase');
        await supabase.from('users')
          .update({ auth_uid: authUser.id })
          .eq('username', localUser.username);
      }
    } catch (authErr) {
      // User belum ada di Supabase Auth — daftarkan otomatis
      try {
        const newAuthUser = await signUpUser(localUser.username, password);
        if (newAuthUser) {
          await db.users.update(localUser.id, { auth_uid: newAuthUser.id, synced: false });
          // Login ulang setelah signup agar JWT aktif
          await signInUser(localUser.username, password);

          // Update auth_uid di Supabase
          const { supabase } = await import('./supabase');
          await supabase.from('users')
            .update({ auth_uid: newAuthUser.id })
            .eq('username', localUser.username);
        }
      } catch (signupErr) {
        console.warn('[Auth] Gagal auto-signup, lanjut mode lokal:', signupErr.message);
      }
    }
  }

  const userData = {
    id: localUser.id,
    username: localUser.username,
    nama: localUser.nama,
    role: localUser.role,
    isDemo: false,
    isSuperAdmin: isSA,
    owner: localUser.owner || null
  };

  setCurrentUser(userData);

  // Pull lalu push — JWT sudah aktif di atas
  if (navigator.onLine) {
    const { pullFromSupabase, syncToSupabase } = await import('./sync');
    // Jalankan async, tidak perlu await agar login tidak lambat
    pullFromSupabase().then(() => syncToSupabase());
  }

  return userData;
}

export async function logout() {
  // Sign out dari Supabase Auth jika online
  if (navigator.onLine && !isDemoAccount()) {
    try {
      await signOutUser();
    } catch {
      // Abaikan error logout Supabase
    }
  }
  setCurrentUser(null);
}

export async function logAudit(action, entityType, entityId, oldData, newData) {
  const user = getCurrentUser();
  if (!user) return;

  await db.audit_logs.add({
    user_id: user.id,
    username: user.username,
    nama: user.nama,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_data: oldData ? JSON.stringify(oldData) : null,
    new_data: newData ? JSON.stringify(newData) : null,
    timestamp: new Date().toISOString(),
    synced: false
  });
}
