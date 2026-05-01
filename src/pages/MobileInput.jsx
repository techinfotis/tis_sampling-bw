import { useState, useEffect } from 'react';
import { createSession, addTimbang, getSessionData, calculateAnalysis, getAllKandangs, deleteTimbang, updateTimbang } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { isDemoAccount } from '../lib/auth';
import { hitungUmurAyam } from './KandangManagement';

export default function MobileInput() {
  const [kandang, setKandang] = useState('');
  const [umurMg, setUmurMg] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [berat, setBerat] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [kandangInfo, setKandangInfo] = useState(null);
  const [dupeWarning, setDupeWarning] = useState(null);
  const [demoData, setDemoData] = useState([]);

  const isDemo = isDemoAccount();
  const kandangs = useLiveQuery(() => getAllKandangs(), []);
  const dbData = useLiveQuery(
    () => (!isDemo && sessionId) ? getSessionData(sessionId) : [],
    [sessionId, isDemo]
  );

  const refreshDemoData = () => {
    if (isDemo && sessionId) {
      const key = `demo_timbang_${sessionId}`;
      const items = JSON.parse(sessionStorage.getItem(key) || '[]');
      setDemoData([...items].reverse());
    }
  };

  const data = isDemo ? demoData : dbData;

  useEffect(() => {
    if (kandang && kandangs) {
      const info = kandangs.find(k => k.kode === kandang);
      setKandangInfo(info);

      // Auto-kalkulasi umur dari chick_in_date
      if (info?.chick_in_date) {
        const umur = hitungUmurAyam(info.chick_in_date, info.chick_in_age);
        if (umur) setUmurMg(String(umur.minggu));
      }
    }
  }, [kandang, kandangs]);

  useEffect(() => {
    if (isDemo && sessionId) {
      refreshDemoData();
    }
  }, [sessionId, isDemo]);

  const handleStartSession = async () => {
    if (!kandang || !umurMg) {
      alert('Pilih kandang dan umur terlebih dahulu');
      return;
    }
    const id = await createSession(kandang, parseInt(umurMg));
    setSessionId(id);
  };

  const handleAddBerat = async () => {
    const val = parseInt(berat);
    if (!berat || isNaN(val) || berat.length > 4) {
      alert('Masukkan berat yang valid (maksimal 4 digit)');
      return;
    }

    // Cek hanya 1 data terakhir (entry sebelumnya)
    const lastEntry = data && data.length > 0 ? data[0] : null; // data sudah di-reverse, [0] = terbaru
    if (lastEntry && lastEntry.berat === val) {
      setDupeWarning({ val, prevNo: lastEntry.id_ayam });
    } else {
      setDupeWarning(null);
    }

    await addTimbang(sessionId, val);
    setBerat('');
    if (isDemo) refreshDemoData();
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddBerat();
  };

  if (!sessionId) {
    return (
      <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Setup Sesi Timbang</h2>

        {!kandangs || kandangs.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
            <p className="text-yellow-800 font-semibold mb-2">⚠️ Belum ada kandang terdaftar</p>
            <p className="text-sm text-yellow-700 mb-3">Silakan daftarkan kandang terlebih dahulu.</p>
            <a href="/kandang" className="inline-block bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700">
              Ke Halaman Kandang
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-semibold">Kandang</label>
              <select
                className="w-full p-2 border rounded"
                value={kandang}
                onChange={(e) => setKandang(e.target.value)}
              >
                <option value="">Pilih Kandang</option>
                {kandangs.map(k => (
                  <option key={k.id} value={k.kode}>{k.kode} - {k.nama}</option>
                ))}
              </select>
            </div>

            {kandangInfo && (
              <div className="bg-blue-50 p-3 rounded-lg text-sm space-y-1">
                <p><strong>Penanggung Jawab:</strong> {kandangInfo.penanggung_jawab}</p>
                <p><strong>Kontak:</strong> {kandangInfo.kontak}</p>
                {kandangInfo.kapasitas && (
                  <p><strong>Kapasitas:</strong> {kandangInfo.kapasitas} ekor</p>
                )}
                {kandangInfo.chick_in_date && (
                  <p><strong>Chick In:</strong> {new Date(kandangInfo.chick_in_date).toLocaleDateString('id-ID')}</p>
                )}
              </div>
            )}

            {/* Umur — auto dari chick_in_date atau manual */}
            <div>
              <label className="block mb-2 font-semibold">Umur (Minggu)</label>

              {/* Tampilkan umur auto-kalkulasi jika chick_in_date tersedia */}
              {kandangInfo?.chick_in_date ? (() => {
                const umur = hitungUmurAyam(kandangInfo.chick_in_date, kandangInfo.chick_in_age);
                return umur ? (
                  <div className="space-y-2">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                      <span className="text-2xl">🐔</span>
                      <div className="flex-1">
                        <p className="text-xs text-green-600">Umur otomatis hari ini</p>
                        <p className="text-lg font-bold text-green-800">{umur.label}</p>
                        <p className="text-xs text-green-600">Total {umur.totalHari} hari</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-full p-2 border rounded"
                        value={umurMg}
                        onChange={(e) => setUmurMg(e.target.value)}
                        placeholder="Minggu ke-"
                      />
                      <span className="text-sm text-gray-500 whitespace-nowrap">mg (edit jika perlu)</span>
                    </div>
                  </div>
                ) : null;
              })() : (
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={umurMg}
                  onChange={(e) => setUmurMg(e.target.value)}
                  placeholder="Contoh: 6"
                />
              )}
            </div>

            <button
              onClick={handleStartSession}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
            >
              Mulai Sesi
            </button>
          </div>
        )}
      </div>
    );
  }

  const handleReset = () => {
    setSessionId(null);
    setKandang('');
    setUmurMg('');
    setShowReview(false);
  };

  if (showReview) {
    return <ReviewScreen sessionId={sessionId} onBack={() => setShowReview(false)} onReset={handleReset} />;
  }

  // Deteksi warning
  const duplicates = data ? data.filter((item, _, arr) =>
    arr.filter(d => d.berat === item.berat).length > 1
  ).map(d => d.berat) : [];
  const uniqueDuplicates = [...new Set(duplicates)];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header & Input */}
      <div className="bg-white p-4 rounded-lg shadow mb-3">
        <div className="mb-3">
          <h2 className="text-lg font-bold">
            Kandang {kandang}
            {kandangInfo?.chick_in_date ? (() => {
              const umur = hitungUmurAyam(kandangInfo.chick_in_date, kandangInfo.chick_in_age);
              return umur
                ? <span className="ml-2 text-green-700">— {umur.label}</span>
                : <span className="ml-2 text-gray-500">— Minggu {umurMg}</span>;
            })() : <span className="ml-2 text-gray-500">— Minggu {umurMg}</span>}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-sm">Jumlah Data: <strong>{data?.length || 0} Ekor</strong></span>
            {kandangInfo?.kapasitas && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                data?.length > kandangInfo.kapasitas
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                Kapasitas: {kandangInfo.kapasitas}
              </span>
            )}
          </div>
          {kandangInfo && <p className="text-xs text-gray-400">PJ: {kandangInfo.penanggung_jawab}</p>}
        </div>

        {/* Warning dobel */}
        {uniqueDuplicates.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded p-2 mb-3 text-sm text-orange-700">
            ⚠️ Berat dobel terdeteksi: <strong>{uniqueDuplicates.join(', ')} gr</strong> — periksa sebelum simpan.
          </div>
        )}

        {/* Warning melebihi kapasitas */}
        {kandangInfo?.kapasitas && data?.length > kandangInfo.kapasitas && (
          <div className="bg-red-50 border border-red-200 rounded p-2 mb-3 text-sm text-red-700">
            ⚠️ Jumlah data ({data.length}) melebihi kapasitas kandang ({kandangInfo.kapasitas} ekor).
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="number"
            className={`flex-1 p-3 border-2 rounded-lg text-lg focus:outline-none ${
              dupeWarning ? 'border-orange-400 focus:border-orange-500' : 'focus:border-green-500'
            }`}
            value={berat}
            onChange={(e) => { setBerat(e.target.value); setDupeWarning(null); }}
            onKeyDown={handleKeyDown}
            placeholder="Berat (gram)"
            autoFocus
          />
          <button
            onClick={handleAddBerat}
            className="w-20 bg-green-600 text-white rounded-lg font-bold text-2xl hover:bg-green-700 active:bg-green-800"
          >
            +
          </button>
        </div>

        {/* Notifikasi dobel — muncul setelah input terakhir sama dengan sebelumnya */}
        {dupeWarning && (
          <div className="mt-2 flex items-center gap-2 bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 text-sm text-orange-700">
            <span className="text-lg">⚠️</span>
            <span>
              Sama dengan data sebelumnya (No. {dupeWarning.prevNo} — {dupeWarning.val} gr). Periksa kembali.
            </span>
            <button
              onClick={() => setDupeWarning(null)}
              className="ml-auto text-orange-400 hover:text-orange-600 font-bold text-base leading-none"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-lg shadow mb-3 max-h-80 overflow-y-auto">
        <div className="sticky top-0 bg-gray-100 px-4 py-2 flex justify-between items-center border-b">
          <span className="font-bold text-sm">Data Timbang</span>
          <span className="text-xs text-gray-500">{data?.length || 0} entri</span>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="p-2 text-left">No</th>
              <th className="p-2 text-right">Berat (gr)</th>
              <th className="p-2 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((item) => {
              const isDuplicate = uniqueDuplicates.includes(item.berat);
              return (
                <tr key={item.id} className={`border-b ${isDuplicate ? 'bg-orange-50' : ''}`}>
                  <td className="p-2 text-sm text-gray-500">{item.id_ayam}</td>
                  <td className="p-2 text-right font-semibold">
                    {item.berat}
                    {isDuplicate && <span className="ml-1 text-xs text-orange-500">●</span>}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1 justify-center">
                      <EditButton item={item} onRefresh={isDemo ? refreshDemoData : undefined} />
                      <DeleteButton item={item} onRefresh={isDemo ? refreshDemoData : undefined} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setShowReview(true)}
        disabled={!data || data.length === 0}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
      >
        Review & Simpan
      </button>
    </div>
  );
}

// Tombol Edit inline
function EditButton({ item, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.berat.toString());

  const handleSave = async () => {
    const newBerat = parseInt(val);
    if (isNaN(newBerat) || val.length > 4) {
      alert('Berat tidak valid');
      return;
    }
    await updateTimbang(item.id, { berat: newBerat });
    setEditing(false);
    if (onRefresh) onRefresh();
  };

  if (editing) {
    return (
      <div className="flex gap-1 items-center">
        <input
          type="number"
          className="w-16 p-1 border rounded text-sm text-center"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        />
        <button onClick={handleSave} className="text-green-600 font-bold text-sm px-1">✓</button>
        <button onClick={() => setEditing(false)} className="text-gray-400 text-sm px-1">✕</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50"
    >
      Edit
    </button>
  );
}

// Tombol Hapus inline
function DeleteButton({ item, onRefresh }) {
  const handleDelete = async () => {
    if (confirm(`Hapus data berat ${item.berat} gr (No. ${item.id_ayam})?`)) {
      await deleteTimbang(item.id);
      if (onRefresh) onRefresh();
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
    >
      Hapus
    </button>
  );
}

function ReviewScreen({ sessionId, onBack, onReset }) {
  const [analysis, setAnalysis] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isDemo = isDemoAccount();

  useEffect(() => {
    calculateAnalysis(sessionId).then(setAnalysis);
  }, [sessionId]);

  const handleSimpan = async () => {
    setSaving(true);
    try {
      if (navigator.onLine) {
        const { syncToSupabase } = await import('../lib/sync');
        await syncToSupabase();
      }
      setSaved(true);
    } catch (err) {
      alert('Gagal sync ke server: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!analysis) return <div className="text-center py-8">Menghitung...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-6">Hasil Analisa</h2>

        {isDemo && (
          <div className="bg-orange-50 border border-orange-300 rounded-lg p-4 mb-6">
            <p className="text-orange-800 font-semibold text-sm">🔒 Mode Demo</p>
            <p className="text-orange-700 text-sm mt-1">
              Data ini hanya tersimpan sementara di browser dan <strong>tidak akan disimpan ke database</strong>. 
              Data akan hilang saat sesi browser ditutup.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-gray-600 text-sm">Total Ekor</p>
            <p className="text-3xl font-bold">{analysis.totalEkor}</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <p className="text-gray-600 text-sm">Rata-rata Berat</p>
            <p className="text-3xl font-bold">{analysis.mean} gr</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded">
            <p className="text-gray-600 text-sm">Keseragaman</p>
            <p className="text-3xl font-bold">{analysis.uniformity}%</p>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <p className="text-gray-600 text-sm">CV</p>
            <p className="text-3xl font-bold">{analysis.cv}%</p>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onBack}
            disabled={saving}
            className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-50"
          >
            ← Kembali Edit
          </button>
          {isDemo ? (
            <button
              disabled
              className="flex-1 bg-gray-300 text-gray-500 py-3 rounded-lg font-semibold cursor-not-allowed"
              title="Akun demo tidak dapat menyimpan ke database"
            >
              🔒 Simpan (Demo)
            </button>
          ) : saved ? (
            <button
              onClick={onReset}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 shadow-md"
            >
              Sesi Baru +
            </button>
          ) : (
            <button
              onClick={handleSimpan}
              disabled={saving}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-green-400"
            >
              {saving ? '⟳ Menyimpan...' : 'Simpan ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
