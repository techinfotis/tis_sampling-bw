import { db } from './db';
import { supabase } from './supabase';
import { isDemoAccount } from './auth';

let isSyncing = false;

// ============================================
// PUSH: Local → Supabase
// ============================================
export async function syncToSupabase() {
  // Jangan sync jika user adalah akun demo
  if (isDemoAccount()) {
    console.log('[Sync] Akun demo — sync dilewati');
    return;
  }

  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;

  try {
    await pushUsers();
    await pushKandangs();
    await pushSessions();
    await pushAuditLogs();
    console.log('[Sync] Push selesai');
  } catch (err) {
    console.error('[Sync] Push error:', err);
  } finally {
    isSyncing = false;
  }
}

async function pushUsers() {
  const all = await db.users.toArray();
  const unsynced = all.filter(u => !u.synced);

  for (const user of unsynced) {
    const { error } = await supabase.from('users').upsert({
      username: user.username,
      password: user.password,
      nama: user.nama,
      role: user.role,
      owner: user.owner || null,
      auth_uid: user.auth_uid || null,
      created_at: user.created_at
    }, { onConflict: 'username' });

    if (!error) await db.users.update(user.id, { synced: true });
    else console.warn('[Sync] pushUsers error:', error.message);
  }
}

async function pushKandangs() {
  const all = await db.kandangs.toArray();
  const unsynced = all.filter(k => !k.synced);

  for (const kandang of unsynced) {
    const { error } = await supabase.from('kandangs').upsert({
      kode: kandang.kode,
      nama: kandang.nama,
      penanggung_jawab: kandang.penanggung_jawab,
      kontak: kandang.kontak,
      kapasitas: kandang.kapasitas || null,
      chick_in_date: kandang.chick_in_date || null,
      chick_in_age: kandang.chick_in_age != null ? kandang.chick_in_age : 0,
      created_at: kandang.created_at,
      created_by: kandang.created_by || null,
      updated_at: kandang.updated_at || null,
      updated_by: kandang.updated_by || null
    }, { onConflict: 'kode' });

    if (!error) await db.kandangs.update(kandang.id, { synced: true });
    else console.warn('[Sync] pushKandangs error:', error.message);
  }
}

async function pushSessions() {
  const all = await db.sessions.toArray();
  const unsynced = all.filter(s => !s.synced);

  console.log('[Sync] Sessions unsynced:', unsynced.length, unsynced.map(s => ({ id: s.id, kandang: s.kandang, created_by: s.created_by })));

  for (const session of unsynced) {
    // Pastikan kandang sudah ada di Supabase dulu
    const { data: kandangExists, error: kandangCheckErr } = await supabase
      .from('kandangs').select('kode').eq('kode', session.kandang).maybeSingle();

    console.log('[Sync] Kandang check:', session.kandang, kandangExists ? '✓ ada' : '✗ tidak ada', kandangCheckErr?.message || '');

    if (!kandangExists) {
      const localKandang = await db.kandangs.where('kode').equals(session.kandang).first();
      console.log('[Sync] Local kandang:', localKandang ? localKandang.kode : '✗ tidak ditemukan di IndexedDB');
      if (localKandang) {
        const { error: kErr } = await supabase.from('kandangs').upsert({
          kode: localKandang.kode,
          nama: localKandang.nama,
          penanggung_jawab: localKandang.penanggung_jawab,
          kontak: localKandang.kontak,
          kapasitas: localKandang.kapasitas || null,
          created_at: localKandang.created_at,
          created_by: localKandang.created_by || null,
          updated_at: localKandang.updated_at || null,
          updated_by: localKandang.updated_by || null
        }, { onConflict: 'kode' });
        if (kErr) { console.warn('[Sync] Push kandang error:', kErr.message); continue; }
        await db.kandangs.update(localKandang.id, { synced: true });
      } else {
        console.warn('[Sync] SKIP: kandang tidak ditemukan lokal:', session.kandang);
        continue;
      }
    }

    // Cek apakah session sudah ada di remote
    const { data: existing, error: existErr } = await supabase
      .from('sessions').select('id')
      .eq('local_id', session.id)
      .eq('created_by', session.created_by || '')
      .eq('created_at', session.created_at) // Tambahkan created_at untuk memastikan keunikan antar perangkat
      .maybeSingle();

    console.log('[Sync] Session existing:', { local_id: session.id, created_by: session.created_by }, existing?.id || 'belum ada', existErr?.message || '');

    let remoteId = existing?.id;

    if (!remoteId) {
      const { data, error } = await supabase.from('sessions').insert({
        local_id: session.id,
        kandang: session.kandang,
        umur_mg: session.umur_mg,
        created_at: session.created_at,
        created_by: session.created_by || null
      }).select().single();

      if (error) {
        console.warn('[Sync] pushSessions INSERT error:', error.message, '|', error.details, '|', error.hint);
        continue;
      }
      remoteId = data.id;
      console.log('[Sync] Session inserted OK, remoteId:', remoteId);
    }

    // Push timbang data
    const timbangData = await db.timbang.where('session_id').equals(session.id).toArray();
    console.log('[Sync] Timbang count for session', session.id, ':', timbangData.length);

    if (timbangData.length > 0) {
      const { data: existingTimbang } = await supabase
        .from('timbang').select('local_id').eq('session_id', remoteId);

      const existingLocalIds = new Set((existingTimbang || []).map(t => t.local_id));
      const newTimbang = timbangData.filter(t => !existingLocalIds.has(t.id));
      console.log('[Sync] New timbang to insert:', newTimbang.length);

      if (newTimbang.length > 0) {
        const { error: tErr } = await supabase.from('timbang').insert(
          newTimbang.map(t => ({
            local_id: t.id,
            session_id: remoteId,
            id_ayam: t.id_ayam,
            berat: t.berat,
            created_at: t.created_at
          }))
        );
        if (tErr) {
          console.warn('[Sync] pushTimbang INSERT error:', tErr.message, '|', tErr.details, '|', tErr.hint);
          continue;
        }
        console.log('[Sync] Timbang inserted OK');
      }
    }

    await db.sessions.update(session.id, { synced: true, remote_id: remoteId });
    console.log('[Sync] Session marked synced:', session.id);
  }
}

async function pushAuditLogs() {
  const all = await db.audit_logs.toArray();
  const unsynced = all.filter(l => !l.synced);

  for (const log of unsynced) {
    const { error } = await supabase.from('audit_logs').insert({
      local_id: log.id,
      user_id: log.user_id?.toString() || null,
      username: log.username,
      nama: log.nama,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id?.toString() || null,
      old_data: log.old_data ? JSON.parse(log.old_data) : null,
      new_data: log.new_data ? JSON.parse(log.new_data) : null,
      timestamp: log.timestamp
    });

    if (!error) await db.audit_logs.update(log.id, { synced: true });
    else console.warn('[Sync] pushAuditLogs error:', error.message);
  }
}

// ============================================
// PULL: Supabase → Local
// ============================================
export async function pullFromSupabase() {
  if (!navigator.onLine) return;

  try {
    console.log('[Sync] Mulai pull...');
    await pullUsers();
    await pullKandangs();
    await pullSessions();
    console.log('[Sync] Pull selesai');
  } catch (err) {
    console.error('[Sync] Pull error:', err);
  }
}

async function pullUsers() {
  const { data, error } = await supabase.from('users').select('*');
  if (error || !data) return;

  for (const remote of data) {
    const existing = await db.users.where('username').equals(remote.username).first();
    if (!existing) {
      await db.users.add({
        username: remote.username,
        password: remote.password,
        nama: remote.nama,
        role: remote.role,
        owner: remote.owner || null,
        auth_uid: remote.auth_uid || null,
        created_at: remote.created_at,
        synced: true
      });
    } else {
      await db.users.update(existing.id, {
        password: remote.password,
        nama: remote.nama,
        role: remote.role,
        owner: remote.owner || null,
        auth_uid: remote.auth_uid || null,
        synced: true
      });
    }

    // Jika ini adalah user yang sedang login, refresh currentUser di localStorage
    const { getCurrentUser, setCurrentUser } = await import('./auth');
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.username === remote.username) {
      const updated = {
        ...currentUser,
        nama: remote.nama,
        role: remote.role,
        owner: remote.owner || null
      };
      setCurrentUser(updated);
      console.log('[Sync] currentUser refreshed:', updated.username, 'owner:', updated.owner);
    }
  }
}

async function pullKandangs() {
  const { data, error } = await supabase.from('kandangs').select('*');
  if (error || !data) return;

  for (const remote of data) {
    const existing = await db.kandangs.where('kode').equals(remote.kode).first();
    if (!existing) {
      await db.kandangs.add({
        kode: remote.kode,
        nama: remote.nama,
        penanggung_jawab: remote.penanggung_jawab,
        kontak: remote.kontak,
        kapasitas: remote.kapasitas,
        chick_in_date: remote.chick_in_date || null,
        chick_in_age: remote.chick_in_age || 0,
        created_at: remote.created_at,
        created_by: remote.created_by,
        updated_at: remote.updated_at,
        updated_by: remote.updated_by,
        synced: true
      });
    } else {
      // Update data lokal dari remote
      await db.kandangs.update(existing.id, {
        nama: remote.nama,
        penanggung_jawab: remote.penanggung_jawab,
        kontak: remote.kontak,
        kapasitas: remote.kapasitas,
        chick_in_date: remote.chick_in_date || null,
        chick_in_age: remote.chick_in_age || 0,
        updated_at: remote.updated_at,
        updated_by: remote.updated_by,
        synced: true
      });
    }
  }
}

async function pullSessions() {
  // Pull semua sessions dari Supabase beserta timbang-nya
  const { data: remoteSessions, error } = await supabase
    .from('sessions')
    .select('id, local_id, kandang, umur_mg, created_at, created_by')
    .order('created_at', { ascending: false });

  if (error || !remoteSessions) {
    console.warn('[Sync] pullSessions error:', error?.message);
    return;
  }

  console.log('[Sync] Pull sessions dari remote:', remoteSessions.length);

  for (const remote of remoteSessions) {
    // Cek apakah session sudah ada di lokal berdasarkan remote_id
    const existingByRemote = await db.sessions
      .filter(s => s.remote_id === remote.id)
      .first();

    let localSessionId;

    if (!existingByRemote) {
      // Belum ada lokal — tambahkan
      localSessionId = await db.sessions.add({
        kandang: remote.kandang,
        umur_mg: remote.umur_mg,
        created_at: remote.created_at,
        created_by: remote.created_by || null,
        synced: true,
        remote_id: remote.id
      });
      console.log('[Sync] Session pulled:', remote.id, '→ local', localSessionId);
    } else {
      localSessionId = existingByRemote.id;
    }

    // Pull timbang untuk session ini
    await pullTimbangForSession(remote.id, localSessionId);
  }
}

async function pullTimbangForSession(remoteSessionId, localSessionId) {
  const { data: remoteTimbang, error } = await supabase
    .from('timbang')
    .select('id, local_id, id_ayam, berat, created_at')
    .eq('session_id', remoteSessionId);

  if (error || !remoteTimbang) return;

  // Ambil semua timbang lokal untuk session ini
  const localTimbang = await db.timbang.where('session_id').equals(localSessionId).toArray();
  const localBeratSet = new Set(localTimbang.map(t => `${t.id_ayam}_${t.berat}`));

  for (const rt of remoteTimbang) {
    const key = `${rt.id_ayam}_${rt.berat}`;
    if (!localBeratSet.has(key)) {
      await db.timbang.add({
        session_id: localSessionId,
        id_ayam: rt.id_ayam,
        berat: rt.berat,
        created_at: rt.created_at
      });
    }
  }
}

// ============================================
// AUTO SYNC
// ============================================
export function initAutoSync() {
  // Sync saat koneksi kembali
  window.addEventListener('online', async () => {
    console.log('[Sync] Koneksi kembali, memulai sync...');
    await syncToSupabase();
    await pullFromSupabase();
  });

  // Sync saat startup jika online
  if (navigator.onLine) {
    // Delay sedikit agar DB sudah siap
    setTimeout(async () => {
      await pullFromSupabase();
      await syncToSupabase();
    }, 1000);
  }
}
