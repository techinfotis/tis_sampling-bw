import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { registerKandang, getAllKandangs, updateKandang, deleteKandang } from '../lib/db';
import { canDelete } from '../lib/auth';

// Hitung umur ayam dari chick_in_date dan chick_in_age (umur DOC saat masuk)
// Return: { minggu, hari, label } atau null
export function hitungUmurAyam(chick_in_date, chick_in_age = 0) {
  if (!chick_in_date) return null;
  const masuk = new Date(chick_in_date);
  const today = new Date();
  // Selisih hari sejak chick in
  const diffMs = today.setHours(0,0,0,0) - masuk.setHours(0,0,0,0);
  const diffHari = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const totalHari = diffHari + (parseInt(chick_in_age) || 0);
  const minggu = Math.floor(totalHari / 7);
  const hari = totalHari % 7;
  return { minggu, hari, totalHari, label: `${minggu} mg ${hari} hr` };
}

export default function KandangManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    kode: '',
    nama: '',
    penanggung_jawab: '',
    kontak: '',
    kapasitas: '',
    chick_in_date: '',
    chick_in_age: '0'
  });

  const kandangs = useLiveQuery(() => getAllKandangs(), []);
  const userCanDelete = canDelete();

  // Hitung kode otomatis: 4 digit + "." (misal: 0001.)
  const generateNextCode = () => {
    if (!kandangs || kandangs.length === 0) return '0001.';
    
    // Ambil semua prefix angka 4 digit
    const numbers = kandangs
      .map(k => {
        const match = k.kode.match(/^(\d{4})\./);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(n => n > 0);
    
    const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : kandangs.length + 1;
    return String(nextNum).padStart(4, '0') + '.';
  };

  const handleShowForm = () => {
    if (!showForm && !editingId) {
      setFormData(prev => ({ ...prev, kode: generateNextCode() }));
    }
    setShowForm(!showForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateKandang(editingId, formData);
        alert('Kandang berhasil diperbarui!');
      } else {
        await registerKandang(formData);
        alert('Kandang berhasil didaftarkan!');
      }
      resetForm();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleEdit = (kandang) => {
    setFormData({
      kode: kandang.kode,
      nama: kandang.nama,
      penanggung_jawab: kandang.penanggung_jawab,
      kontak: kandang.kontak,
      kapasitas: kandang.kapasitas || '',
      chick_in_date: kandang.chick_in_date || '',
      chick_in_age: kandang.chick_in_age != null ? String(kandang.chick_in_age) : '0'
    });
    setEditingId(kandang.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!userCanDelete) {
      alert('Hanya admin yang dapat menghapus data!');
      return;
    }
    if (confirm('Yakin ingin menghapus kandang ini?')) {
      try {
        await deleteKandang(id);
        alert('Kandang berhasil dihapus!');
      } catch (error) {
        alert(error.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      kode: '',
      nama: '',
      penanggung_jawab: '',
      kontak: '',
      kapasitas: '',
      chick_in_date: '',
      chick_in_age: '0'
    });
    setEditingId(null);
    setShowForm(false);
  };

  // Preview umur saat ini berdasarkan input form
  const previewUmur = hitungUmurAyam(formData.chick_in_date, formData.chick_in_age);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Manajemen Kandang</h2>
          <button
            onClick={handleShowForm}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            {showForm ? 'Tutup Form' : '+ Daftar Kandang Baru'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-xl font-semibold mb-4">
              {editingId ? 'Edit Kandang' : 'Daftar Kandang Baru'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-semibold">Kode Kandang *</label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full p-2 border rounded disabled:bg-gray-100"
                    value={formData.kode}
                    onChange={(e) => setFormData({ ...formData, kode: e.target.value })}
                    placeholder="Contoh: 0001.A"
                    required
                    disabled={editingId !== null}
                  />
                  {!editingId && !formData.kode.includes('.') && (
                    <p className="text-[10px] text-orange-600 mt-1">Format: 0001.NamaKandang</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block mb-2 font-semibold">Nama Kandang *</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Contoh: Kandang Broiler A"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">Penanggung Jawab *</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={formData.penanggung_jawab}
                  onChange={(e) => setFormData({ ...formData, penanggung_jawab: e.target.value })}
                  placeholder="Nama lengkap"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">Kontak *</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={formData.kontak}
                  onChange={(e) => setFormData({ ...formData, kontak: e.target.value })}
                  placeholder="No. HP / Email"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 font-semibold">Kapasitas (ekor)</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={formData.kapasitas}
                  onChange={(e) => setFormData({ ...formData, kapasitas: e.target.value })}
                  placeholder="Contoh: 5000"
                />
              </div>

              {/* Chick In Date */}
              <div>
                <label className="block mb-2 font-semibold">Tanggal Chick In</label>
                <input
                  type="date"
                  className="w-full p-2 border rounded"
                  value={formData.chick_in_date}
                  onChange={(e) => setFormData({ ...formData, chick_in_date: e.target.value })}
                />
              </div>

              {/* Umur DOC saat masuk */}
              <div>
                <label className="block mb-2 font-semibold">
                  Umur DOC saat Chick In (hari)
                  <span className="text-xs text-gray-400 font-normal ml-1">— biasanya 0 atau 1</span>
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={formData.chick_in_age}
                  onChange={(e) => setFormData({ ...formData, chick_in_age: e.target.value })}
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Preview umur saat ini */}
              {previewUmur && (
                <div className="md:col-span-2">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                    <span className="text-2xl">🐔</span>
                    <div>
                      <p className="text-sm text-green-700 font-semibold">Umur ayam hari ini</p>
                      <p className="text-xl font-bold text-green-800">{previewUmur.label}</p>
                      <p className="text-xs text-green-600">Total {previewUmur.totalHari} hari</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-6">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
              >
                {editingId ? 'Update' : 'Daftar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-400 text-white px-6 py-2 rounded-lg hover:bg-gray-500"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">Daftar Kandang Terdaftar</h3>

        {!kandangs || kandangs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Belum ada kandang terdaftar.</p>
            <p className="text-sm mt-2">Klik tombol "Daftar Kandang Baru" untuk memulai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Kode</th>
                  <th className="p-3 text-left">Nama Kandang</th>
                  <th className="p-3 text-left">Penanggung Jawab</th>
                  <th className="p-3 text-left">Kontak</th>
                  <th className="p-3 text-left">Kapasitas</th>
                  <th className="p-3 text-left">Chick In</th>
                  <th className="p-3 text-left">Umur Sekarang</th>
                  <th className="p-3 text-left">Dibuat Oleh</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {kandangs.map((kandang) => {
                  const umur = hitungUmurAyam(kandang.chick_in_date, kandang.chick_in_age);
                  return (
                    <tr key={kandang.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold">{kandang.kode}</td>
                      <td className="p-3">{kandang.nama}</td>
                      <td className="p-3">{kandang.penanggung_jawab}</td>
                      <td className="p-3">{kandang.kontak}</td>
                      <td className="p-3">{kandang.kapasitas ? `${kandang.kapasitas} ekor` : '-'}</td>
                      <td className="p-3 text-sm">
                        {kandang.chick_in_date ? (
                          <div>
                            <p className="font-semibold">{new Date(kandang.chick_in_date).toLocaleDateString('id-ID')}</p>
                            {kandang.chick_in_age > 0 && (
                              <p className="text-xs text-gray-500">DOA: {kandang.chick_in_age} hr</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {umur ? (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-sm font-semibold px-2 py-1 rounded-full">
                            🐔 {umur.label}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-sm">
                          <p className="font-semibold">{kandang.created_by || '-'}</p>
                          {kandang.updated_by && (
                            <p className="text-xs text-gray-500">Edit: {kandang.updated_by}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEdit(kandang)}
                            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                          >
                            Edit
                          </button>
                          {userCanDelete && (
                            <button
                              onClick={() => handleDelete(kandang.id)}
                              className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                            >
                              Hapus
                            </button>
                          )}
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

      {kandangs && kandangs.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg mt-6">
          <p className="text-sm text-blue-800">
            💡 <strong>Tips:</strong> Isi tanggal chick in agar umur ayam terhitung otomatis saat input timbang.
          </p>
          {!userCanDelete && (
            <p className="text-sm text-orange-700 mt-2">
              ⚠️ <strong>Catatan:</strong> Anda tidak memiliki akses untuk menghapus data. Hanya admin yang dapat menghapus kandang.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
