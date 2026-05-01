import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function testConnection() {
  try {
    const { error } = await supabase.from('kandangs').select('count').limit(1);
    return !error;
  } catch {
    return false;
  }
}

// ============================================
// AUTH HELPERS (Opsi A: username → fake email)
// ============================================

// Konversi username ke fake email untuk Supabase Auth
export function usernameToEmail(username) {
  return `${username}@smartfarm.local`;
}

// Daftarkan user baru ke Supabase Auth
// Dipanggil saat admin membuat user baru
export async function signUpUser(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Tidak perlu konfirmasi email
      emailRedirectTo: undefined
    }
  });
  if (error) throw new Error(error.message);
  return data.user; // { id: auth_uid, ... }
}

// Login user ke Supabase Auth
export async function signInUser(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user; // { id: auth_uid, ... }
}

// Logout dari Supabase Auth
export async function signOutUser() {
  await supabase.auth.signOut();
}

// Ambil session Supabase Auth yang aktif
export async function getAuthSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Update password user di Supabase Auth
// Hanya bisa untuk user yang sedang login
export async function updateAuthPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
