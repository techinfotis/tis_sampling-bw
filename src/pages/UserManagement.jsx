import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllUsers, createUser, updateUser, deleteUser } from '../lib/db';
import { isAdmin, getCurrentUser, isDemoAccount, canManageUsers, isSuperAdmin } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

const DEMO_USERNAMES = ['admin', 'operator'];
const SUPERADMIN_USERNAME = 'shakadigital';

export default function UserManagement() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isDemo = isDemoAccount();
  const canManage = canManageUsers();
  const superAdmin = isSuperAdmin();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    username: '', password: '', nama: '', role: 'operator'
  });

  const allUsers = useLiveQuery(() => getAllUsers(), []);

  // Demo hanya lihat akun demo
  const users = isDemo
    ? allUsers?.filter(u => DEMO_USERNAMES.includes(u.username))
    : allUsers;

  if (!isAdmin()) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg text-center">
          <h2 className="text-2xl font-bold text-red-700 mb-2">⛔ Akses Ditolak</h2>
          <p className="text-red-600 mb-4">Halaman ini hanya dapat diakses oleh Administrator.</p>
          <button onClick={() => navigate('/')} className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700">
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) { alert('Akun demo tidak dapat mengelola user resmi.'); return; }
    try {
      if (editingId) {
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password;
        await updateUser(editingId, updateData);
        alert('User berhasil diperbarui!');
      } else {
        if (!formData.password) { alert('Password harus diisi!'); return; }
        await createUser(formData);
        alert('User berhasil ditambahkan!');
      }
      resetForm();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleEdit = (user) => {
    if (!canManage) { alert('Akun demo tidak dapat mengedit user.'); return; }
    if (user.username === SUPERADMIN_USERNAME) { alert('Akun Superadmin tidak dapat diedit.'); return; }
    if (DEMO_USERNAMES.includes(user.username)) { alert('Akun demo tidak dapat diedit.'); return; }
    setFormData({ username: user.username, password: '', nama: user.nama, role: user.role });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleDelete = async (id, username) => {
    if (!canManage) { alert('Akun demo tidak dapat menghapus user.'); return; }
    if (username === SUPERADMIN_USERNAME) { alert('Akun Superadmin tidak dapat dihapus.'); return; }
    if (DEMO_USERNAMES.includes(username)) { alert('Akun demo tidak dapat dihapus.'); return; }
    if (currentUser.username === username) { alert('Anda tidak dapat menghapus akun Anda sendiri!'); return; }
    if (confirm(`Yakin ingin menghapus user "${username}"?`)) {
      try {
        await deleteUser(id);
        alert('User berhasil dihapus!');
      } catch (error) {
        alert(error.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({ username: '', password: '', nama: '', role: 'operator' });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">👥 Manajemen User</h2>
          <div className="flex gap-2">
            {canManage && (
              <>
                <button
                  onClick={async () => {
                    const { syncToSupabase } = await import('../lib/sync');
                    await syncToSupabase();
                    alert('Sync selesai!');
                  }}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm"
                >
                  ⟳ Sync ke Cloud
                </button>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  {showForm ? 'Tutup Form' : '+ Tambah User Baru'}
                </button>
              </>
            )}
          </div>
        </div>

        {isDemo && (
          <div className="bg-orange-50 border border-orange-300 rounded-lg p-4 mb-4">
            <p className="text-orange-800 font-semibold text-sm">🔒 Mode Demo</p>
            <p className="text-orange-700 text-sm mt-1">
              Hanya akun demo yang ditampilkan. User resmi tidak dapat dilihat atau dikelola dari akun ini.
            </p>
          </div>
        )}

        {showForm && canManage && (
          <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-xl font-semibold mb-4">{editingId ? 'Edit User' : 'Tambah User Baru'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-semibold">Username *</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded disabled:bg-gray-100"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Username untuk login"
                  required
                  disabled={editingId !== null}
                />
                {editingId && <p className="text-xs text-gray-500 mt-1">Username tidak dapat diubah</p>}
              </div>

              <div>
                <label className="block mb-2 font-semibold">
                  Password {editingId ? '(kosongkan jika tidak diubah)' : '*'}
                </label>
                <input
                  type="password"
                  className="w-full p-2 border rounded"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingId ? 'Kosongkan jika tidak diubah' : 'Password untuk login'}
                  required={!editingId}
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">Nama Lengkap *</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Nama lengkap user"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">Role *</label>
                <select
                  className="w-full p-2 border rounded"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  <option value="operator">Operator</option>
                  {superAdmin && <option value="admin">Admin</option>}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {superAdmin
                    ? 'Admin: Kelola user & kandang sendiri | Operator: Input data'
                    : 'Anda hanya dapat menambahkan Operator'}
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">
                {editingId ? 'Update' : 'Tambah'}
              </button>
              <button type="button" onClick={resetForm} className="bg-gray-400 text-white px-6 py-2 rounded-lg hover:bg-gray-500">
                Batal
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">Daftar User</h3>

        {!users || users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Belum ada user terdaftar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Username</th>
                  <th className="p-3 text-left">Nama Lengkap</th>
                  <th className="p-3 text-left">Role</th>
                  {superAdmin && <th className="p-3 text-left">Milik Admin</th>}
                  <th className="p-3 text-left">Dibuat</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSuperAdminRow = user.username === SUPERADMIN_USERNAME;
                  const isDemoRow = DEMO_USERNAMES.includes(user.username);
                  const isCurrentUser = currentUser.username === user.username;

                  return (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{user.username}</span>
                          {isCurrentUser && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Anda</span>
                          )}
                          {isDemoRow && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Demo</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">{user.nama}</td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded text-sm font-semibold ${
                          isSuperAdminRow ? 'bg-purple-100 text-purple-700'
                          : isDemoRow ? 'bg-orange-100 text-orange-700'
                          : user.role === 'admin' ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                        }`}>
                          {isSuperAdminRow ? '🔐 Superadmin'
                            : isDemoRow ? `🎭 Demo (${user.role === 'admin' ? 'Admin' : 'Operator'})`
                            : user.role === 'admin' ? '👑 Admin'
                            : '👤 Operator'}
                        </span>
                      </td>
                      {superAdmin && (
                        <td className="p-3 text-sm text-gray-600">
                          {isSuperAdminRow || isDemoRow ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : user.owner ? (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">{user.owner}</span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">tidak ada</span>
                          )}
                        </td>
                      )}
                      <td className="p-3 text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-center">
                          {isSuperAdminRow || isDemoRow ? (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                              {isSuperAdminRow ? '🔐 Dilindungi' : '🎭 Akun Demo'}
                            </span>
                          ) : isDemo ? (
                            <span className="text-xs text-gray-400 italic">Hanya lihat</span>
                          ) : canManage ? (
                            <>
                              <button
                                onClick={() => handleEdit(user)}
                                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(user.id, user.username)}
                                disabled={isCurrentUser}
                                className={`px-3 py-1 rounded text-sm ${
                                  isCurrentUser
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-red-500 text-white hover:bg-red-600'
                                }`}
                              >
                                Hapus
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg mt-6">
        <p className="text-sm font-semibold text-yellow-800">⚠️ Perhatian:</p>
        <ul className="text-sm text-yellow-700 mt-2 space-y-1 ml-4 list-disc">
          <li>Anda tidak dapat menghapus akun Anda sendiri.</li>
          <li>Username tidak dapat diubah setelah dibuat.</li>
        </ul>
      </div>
    </div>
  );
}
