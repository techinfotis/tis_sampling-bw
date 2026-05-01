import Dexie from 'dexie';
import { getCurrentUser, logAudit, isDemoAccount, getDataScope, isSuperAdmin } from './auth';

export const db = new Dexie('SmartFarmDB');

// Version 1: Initial schema
db.version(1).stores({
  sessions: '++id, kandang, umur_mg, created_at, synced',
  timbang: '++id, session_id, id_ayam, berat, created_at'
});

// Version 2: Add kandangs table
db.version(2).stores({
  kandangs: '++id, kode, nama, penanggung_jawab, kontak, kapasitas, created_at',
  sessions: '++id, kandang, umur_mg, created_at, synced',
  timbang: '++id, session_id, id_ayam, berat, created_at'
});

// Version 3: Add users and audit_logs
db.version(3).stores({
  users: '++id, username, nama, role, created_at',
  kandangs: '++id, kode, nama, penanggung_jawab, kontak, kapasitas, created_at, created_by, updated_by',
  sessions: '++id, kandang, umur_mg, created_at, synced, created_by',
  timbang: '++id, session_id, id_ayam, berat, created_at',
  audit_logs: '++id, user_id, username, action, entity_type, entity_id, timestamp'
}).upgrade(tx => {
  return tx.table('users').bulkAdd([
    {
      username: 'admin',
      password: 'admin123',
      nama: 'Administrator',
      role: 'admin',
      created_at: new Date().toISOString(),
      synced: false
    },
    {
      username: 'operator',
      password: 'operator123',
      nama: 'Operator',
      role: 'operator',
      created_at: new Date().toISOString(),
      synced: false
    }
  ]);
});

// Version 4: Add synced flag and remote_id for cloud sync
db.version(4).stores({
  users: '++id, username, nama, role, created_at, synced',
  kandangs: '++id, kode, nama, penanggung_jawab, kontak, kapasitas, created_at, created_by, updated_by, synced',
  sessions: '++id, kandang, umur_mg, created_at, synced, created_by, remote_id',
  timbang: '++id, session_id, id_ayam, berat, created_at',
  audit_logs: '++id, user_id, username, action, entity_type, entity_id, timestamp, synced'
});

// Version 5: Add owner field to users for multi-admin isolation
db.version(5).stores({
  users: '++id, username, nama, role, owner, created_at, synced',
  kandangs: '++id, kode, nama, penanggung_jawab, kontak, kapasitas, created_at, created_by, updated_by, synced',
  sessions: '++id, kandang, umur_mg, created_at, synced, created_by, remote_id',
  timbang: '++id, session_id, id_ayam, berat, created_at',
  audit_logs: '++id, user_id, username, action, entity_type, entity_id, timestamp, synced'
});

// Version 6: Add auth_uid for Supabase Auth mapping
db.version(6).stores({
  users: '++id, username, nama, role, owner, auth_uid, created_at, synced',
  kandangs: '++id, kode, nama, penanggung_jawab, kontak, kapasitas, created_at, created_by, updated_by, synced',
  sessions: '++id, kandang, umur_mg, created_at, synced, created_by, remote_id',
  timbang: '++id, session_id, id_ayam, berat, created_at',
  audit_logs: '++id, user_id, username, action, entity_type, entity_id, timestamp, synced'
});

// Version 7: Add chick_in_date and chick_in_age to kandangs
db.version(7).stores({
  users: '++id, username, nama, role, owner, auth_uid, created_at, synced',
  kandangs: '++id, kode, nama, penanggung_jawab, kontak, kapasitas, chick_in_date, chick_in_age, created_at, created_by, updated_by, synced',
  sessions: '++id, kandang, umur_mg, created_at, synced, created_by, remote_id',
  timbang: '++id, session_id, id_ayam, berat, created_at',
  audit_logs: '++id, user_id, username, action, entity_type, entity_id, timestamp, synced'
});

// ============================================
// SESSION
// ============================================
export async function createSession(kandang, umur_mg) {
  const user = getCurrentUser();
  const isDemo = isDemoAccount();

  // Akun demo: simpan hanya ke sessionStorage (tidak ke IndexedDB)
  if (isDemo) {
    const demoId = `demo_${Date.now()}`;
    const demoSession = {
      id: demoId,
      kandang,
      umur_mg,
      created_at: new Date().toISOString(),
      isDemo: true
    };
    sessionStorage.setItem(`demo_session_${demoId}`, JSON.stringify(demoSession));
    return demoId;
  }

  const id = await db.sessions.add({
    kandang,
    umur_mg,
    created_at: new Date().toISOString(),
    synced: false,
    created_by: user ? user.username : 'unknown'
  });

  if (user) {
    await logAudit('create', 'session', id, null, { kandang, umur_mg });
  }

  return id;
}

export async function addTimbang(session_id, berat) {
  const isDemo = isDemoAccount();

  // Akun demo: simpan ke sessionStorage saja
  if (isDemo) {
    const key = `demo_timbang_${session_id}`;
    const existing = JSON.parse(sessionStorage.getItem(key) || '[]');
    existing.push({
      id: existing.length + 1,
      session_id,
      id_ayam: existing.length + 1,
      berat,
      created_at: new Date().toISOString()
    });
    sessionStorage.setItem(key, JSON.stringify(existing));
    return;
  }

  const count = await db.timbang.where('session_id').equals(session_id).count();
  await db.timbang.add({
    session_id,
    id_ayam: count + 1,
    berat,
    created_at: new Date().toISOString()
  });

  // Tandai session sebagai unsynced agar timbang baru ikut ter-push
  await db.sessions.update(session_id, { synced: false });

  // Langsung push ke Supabase jika online (opsional tapi disarankan)
  if (navigator.onLine) {
    import('./sync').then(module => module.syncToSupabase());
  }
}

// Ambil semua sessions sesuai scope user
export async function getScopedSessions() {
  const scope = getDataScope();
  if (scope === null) {
    return await db.sessions.toArray();
  }

  // Dapatkan semua kandang dalam scope admin ini
  const scopedKandangs = await getAllKandangs();
  const scopedKodes = new Set(scopedKandangs.map(k => k.kode));

  // Dapatkan semua username yang berada di bawah admin ini (rekursif)
  const subordinateList = await getSubordinateUsernames(scope);
  const scopedUsernames = new Set(subordinateList);

  // Session termasuk jika:
  // 1. Dibuat oleh user dalam scope
  // 2. Berada di kandang yang bisa dilihat oleh user dalam scope
  return await db.sessions.filter(s =>
    scopedUsernames.has(s.created_by) || scopedKodes.has(s.kandang)
  ).toArray();
}

export async function getSessionData(session_id) {
  const isDemo = isDemoAccount();

  // Akun demo: baca dari sessionStorage
  if (isDemo) {
    const key = `demo_timbang_${session_id}`;
    return JSON.parse(sessionStorage.getItem(key) || '[]').reverse();
  }

  return await db.timbang.where('session_id').equals(session_id).reverse().toArray();
}

export async function calculateAnalysis(session_id) {
  const isDemo = isDemoAccount();

  let data;
  if (isDemo) {
    const key = `demo_timbang_${session_id}`;
    data = JSON.parse(sessionStorage.getItem(key) || '[]');
  } else {
    data = await db.timbang.where('session_id').equals(session_id).toArray();
  }
  if (data.length === 0) return null;

  const weights = data.map(d => d.berat);
  const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
  const variance = weights.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / weights.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100;

  const lowerBound = mean * 0.9;
  const upperBound = mean * 1.1;
  const uniformCount = weights.filter(w => w >= lowerBound && w <= upperBound).length;
  const uniformity = (uniformCount / weights.length) * 100;

  return {
    totalEkor: weights.length,
    mean: Math.round(mean),
    cv: cv.toFixed(2),
    uniformity: uniformity.toFixed(2),
    stdDev: stdDev.toFixed(2)
  };
}

// ============================================
// KANDANG
// ============================================
export async function registerKandang(data) {
  if (isDemoAccount()) {
    throw new Error('Akun demo tidak dapat menyimpan data kandang.');
  }

  const exists = await db.kandangs.where('kode').equals(data.kode).first();
  if (exists) throw new Error('Kode kandang sudah terdaftar');

  const user = getCurrentUser();
  const id = await db.kandangs.add({
    ...data,
    created_at: new Date().toISOString(),
    created_by: user ? user.username : 'unknown',
    updated_by: null,
    synced: false
  });

  if (user) await logAudit('create', 'kandang', id, null, data);
  return id;
}

export async function getAllKandangs() {
  const scope = getDataScope();
  if (scope === null) {
    // superadmin atau demo: lihat semua
    return await db.kandangs.toArray();
  }

  // Dapatkan semua username bawahan
  const subordinateList = await getSubordinateUsernames(scope);
  const subordinateSet = new Set(subordinateList);

  // User bisa melihat kandang yang dibuat oleh dirinya sendiri atau bawahannya
  return await db.kandangs.filter(k => subordinateSet.has(k.created_by)).toArray();
}

export async function getKandangByKode(kode) {
  return await db.kandangs.where('kode').equals(kode).first();
}

export async function updateKandang(id, data) {
  if (isDemoAccount()) {
    throw new Error('Akun demo tidak dapat mengubah data kandang.');
  }

  const user = getCurrentUser();
  const oldData = await db.kandangs.get(id);

  await db.kandangs.update(id, {
    ...data,
    updated_by: user ? user.username : 'unknown',
    updated_at: new Date().toISOString(),
    synced: false
  });

  if (user) await logAudit('update', 'kandang', id, oldData, data);
}

export async function deleteKandang(id) {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    throw new Error('Hanya admin yang dapat menghapus data');
  }
  if (isDemoAccount()) {
    throw new Error('Akun demo tidak dapat menghapus data kandang.');
  }

  const oldData = await db.kandangs.get(id);
  
  if (oldData && navigator.onLine) {
    try {
      const { supabase } = await import('./supabase');
      const { error } = await supabase.from('kandangs').delete().eq('kode', oldData.kode);
      if (error) console.error('[DB] deleteKandang Supabase error:', error.message);
    } catch (err) {
      console.warn('[DB] deleteKandang Supabase fail:', err.message);
    }
  }

  await db.kandangs.delete(id);
  await logAudit('delete', 'kandang', id, oldData, null);
}

export async function deleteTimbang(id) {
  if (isDemoAccount()) {
    // Hapus dari sessionStorage — cari di semua key demo_timbang_*
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('demo_timbang_')) {
        const items = JSON.parse(sessionStorage.getItem(key) || '[]');
        const filtered = items.filter(item => item.id !== id);
        if (filtered.length !== items.length) {
          // Re-number id_ayam
          filtered.forEach((item, idx) => { item.id_ayam = idx + 1; });
          sessionStorage.setItem(key, JSON.stringify(filtered));
          return;
        }
      }
    }
    return;
  }

  const oldData = await db.timbang.get(id);
  if (oldData && navigator.onLine) {
    try {
      const session = await db.sessions.get(oldData.session_id);
      if (session && session.remote_id) {
        const { supabase } = await import('./supabase');
        const { error } = await supabase.from('timbang').delete()
          .eq('local_id', oldData.id)
          .eq('session_id', session.remote_id);
        if (error) console.error('[DB] deleteTimbang Supabase error:', error.message);
      }
    } catch (err) {
      console.warn('[DB] deleteTimbang Supabase fail:', err.message);
    }
  }

  await db.timbang.delete(id);
}

export async function updateTimbang(id, data) {
  if (isDemoAccount()) {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('demo_timbang_')) {
        const items = JSON.parse(sessionStorage.getItem(key) || '[]');
        const idx = items.findIndex(item => item.id === id);
        if (idx !== -1) {
          items[idx] = { ...items[idx], ...data };
          sessionStorage.setItem(key, JSON.stringify(items));
          return;
        }
      }
    }
    return;
  }

  await db.timbang.update(id, data);

  if (navigator.onLine) {
    try {
      const updatedData = await db.timbang.get(id);
      if (updatedData) {
        const session = await db.sessions.get(updatedData.session_id);
        if (session && session.remote_id) {
          const { supabase } = await import('./supabase');
          const { error } = await supabase.from('timbang').update({ berat: updatedData.berat })
            .eq('local_id', updatedData.id)
            .eq('session_id', session.remote_id);
          if (error) console.error('[DB] updateTimbang Supabase error:', error.message);
        }
      }
    } catch (err) {
      console.warn('[DB] updateTimbang Supabase fail:', err.message);
    }
  }
}

// ============================================
// AUDIT LOGS
// ============================================
export async function getAuditLogs(filters = {}) {
  let query = db.audit_logs.orderBy('timestamp').reverse();

  if (filters.entity_type) {
    query = query.filter(log => log.entity_type === filters.entity_type);
  }
  if (filters.action) {
    query = query.filter(log => log.action === filters.action);
  }

  return await query.toArray();
}

// ============================================
// USERS
// ============================================

// Fungsi bantu untuk mendapatkan semua username bawahan (rekursif)
export async function getSubordinateUsernames(topUsername) {
  const allUsers = await db.users.toArray();
  const subordinates = new Set([topUsername]);
  
  let added;
  do {
    added = false;
    for (const user of allUsers) {
      // Jika owner-nya ada di dalam set subordinates kita, maka dia adalah bawahan kita
      if (user.owner && subordinates.has(user.owner) && !subordinates.has(user.username)) {
        subordinates.add(user.username);
        added = true;
      }
    }
  } while (added);
  
  return Array.from(subordinates);
}

export async function getAllUsers() {
  const scope = getDataScope();
  if (scope === null) {
    return await db.users.toArray();
  }
  
  const subordinateList = await getSubordinateUsernames(scope);
  const subordinateSet = new Set(subordinateList);
  
  return await db.users.filter(u => subordinateSet.has(u.username)).toArray();
}

export async function createUser(data) {
  const exists = await db.users.where('username').equals(data.username).first();
  if (exists) throw new Error('Username sudah terdaftar');

  const currentUser = getCurrentUser();
  // owner = admin yang membuat user ini (superadmin tidak punya owner)
  const owner = isSuperAdmin() ? null : currentUser?.username || null;

  // Daftarkan ke Supabase Auth jika online
  let auth_uid = null;
  if (navigator.onLine) {
    try {
      const { signUpUser } = await import('./supabase');
      const authUser = await signUpUser(data.username, data.password);
      auth_uid = authUser?.id || null;
    } catch (err) {
      console.warn('[DB] createUser: gagal signup Supabase Auth:', err.message);
      // Lanjut simpan lokal, auth_uid akan di-set saat user pertama kali login
    }
  }

  const id = await db.users.add({
    ...data,
    owner,
    auth_uid,
    created_at: new Date().toISOString(),
    synced: false
  });

  // Langsung push ke Supabase jika online
  if (navigator.onLine) {
    const { syncToSupabase } = await import('./sync');
    syncToSupabase();
  }

  return id;
}

export async function updateUser(id, data) {
  const updateData = { ...data };
  delete updateData.username;

  // Jika password diubah, update juga di Supabase Auth
  if (updateData.password && navigator.onLine) {
    try {
      // Ambil user untuk tahu username-nya
      const user = await db.users.get(id);
      if (user) {
        // Re-login sebagai user tersebut tidak mungkin dari sini,
        // tapi kita bisa update via admin API jika ada service role key.
        // Untuk sekarang: catat bahwa password perlu di-sync saat user login berikutnya.
        // Password tetap disimpan lokal untuk offline support.
        console.info('[DB] updateUser: password diubah, akan di-sync saat login berikutnya');
      }
    } catch (err) {
      console.warn('[DB] updateUser: gagal update Supabase Auth password:', err.message);
    }
  }

  if (!updateData.password) delete updateData.password;
  await db.users.update(id, { ...updateData, synced: false });

  // Langsung push ke Supabase jika online
  if (navigator.onLine) {
    const { syncToSupabase } = await import('./sync');
    syncToSupabase();
  }
}

export async function deleteUser(id) {
  const user = await db.users.get(id);
  if (user && navigator.onLine) {
    try {
      const { supabase } = await import('./supabase');
      const { error } = await supabase.from('users').delete().eq('username', user.username);
      if (error) console.error('[DB] deleteUser Supabase error:', error.message);
    } catch (err) {
      console.warn('[DB] deleteUser Supabase fail:', err.message);
    }
  }

  await db.users.delete(id);
}
