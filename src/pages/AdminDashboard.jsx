import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAuditLogs } from '../lib/db';
import { isAdmin } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');

  // Cek apakah user adalah admin
  if (!isAdmin()) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg text-center">
          <h2 className="text-2xl font-bold text-red-700 mb-2">⛔ Akses Ditolak</h2>
          <p className="text-red-600 mb-4">Halaman ini hanya dapat diakses oleh Administrator.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  const auditLogs = useLiveQuery(
    () => getAuditLogs({ entity_type: filterType || undefined, action: filterAction || undefined }),
    [filterType, filterAction]
  );

  const getActionBadge = (action) => {
    const badges = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800'
    };
    return badges[action] || 'bg-gray-100 text-gray-800';
  };

  const getActionText = (action) => {
    const texts = {
      create: 'Buat',
      update: 'Edit',
      delete: 'Hapus'
    };
    return texts[action] || action;
  };

  const getEntityText = (type) => {
    const texts = {
      kandang: 'Kandang',
      session: 'Sesi Timbang'
    };
    return texts[type] || type;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-2xl font-bold mb-4">🔐 Dashboard Admin - Audit Trail</h2>
        <p className="text-gray-600 mb-4">
          Histori perubahan data penting dalam sistem. Untuk mengelola user, kunjungi menu <strong>Users</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 font-semibold">Filter Tipe Data</label>
            <select
              className="w-full p-2 border rounded"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Semua Tipe</option>
              <option value="kandang">Kandang</option>
              <option value="session">Sesi Timbang</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 font-semibold">Filter Aksi</label>
            <select
              className="w-full p-2 border rounded"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="">Semua Aksi</option>
              <option value="create">Buat Baru</option>
              <option value="update">Edit</option>
              <option value="delete">Hapus</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">Histori Perubahan Data</h3>

        {!auditLogs || auditLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Belum ada histori perubahan data.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Waktu</th>
                  <th className="p-3 text-left">User</th>
                  <th className="p-3 text-left">Aksi</th>
                  <th className="p-3 text-left">Tipe Data</th>
                  <th className="p-3 text-left">Detail</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      {new Date(log.timestamp).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="p-3">
                      <div>
                        <p className="font-semibold">{log.nama}</p>
                        <p className="text-xs text-gray-500">@{log.username}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionBadge(log.action)}`}>
                        {getActionText(log.action)}
                      </span>
                    </td>
                    <td className="p-3">{getEntityText(log.entity_type)}</td>
                    <td className="p-3">
                      <AuditDetail log={log} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg mt-6">
        <p className="text-sm text-blue-800">
          💡 <strong>Catatan:</strong> Data input per ekor tidak dicatat dalam audit trail untuk efisiensi. 
          Hanya perubahan data penting seperti kandang dan sesi timbang yang direkam.
        </p>
        <p className="text-sm text-blue-800 mt-2">
          👥 Untuk mengelola user (tambah/edit/hapus), kunjungi menu <strong>Users</strong>.
        </p>
      </div>
    </div>
  );
}

function AuditDetail({ log }) {
  const [showDetail, setShowDetail] = useState(false);

  const getChangeSummary = () => {
    if (log.action === 'create') {
      const data = JSON.parse(log.new_data);
      if (log.entity_type === 'kandang') {
        return `Kandang ${data.kode} - ${data.nama}`;
      } else if (log.entity_type === 'session') {
        return `Kandang ${data.kandang}, Minggu ${data.umur_mg}`;
      }
    } else if (log.action === 'update') {
      const oldData = JSON.parse(log.old_data);
      const newData = JSON.parse(log.new_data);
      const changes = [];
      
      Object.keys(newData).forEach(key => {
        if (oldData[key] !== newData[key]) {
          changes.push(`${key}: "${oldData[key]}" → "${newData[key]}"`);
        }
      });
      
      return changes.length > 0 ? changes.join(', ') : 'Tidak ada perubahan';
    } else if (log.action === 'delete') {
      const data = JSON.parse(log.old_data);
      if (log.entity_type === 'kandang') {
        return `Kandang ${data.kode} - ${data.nama}`;
      }
    }
    
    return 'Detail tidak tersedia';
  };

  return (
    <div>
      <button
        onClick={() => setShowDetail(!showDetail)}
        className="text-blue-600 hover:text-blue-800 text-xs underline"
      >
        {showDetail ? 'Sembunyikan' : 'Lihat Detail'}
      </button>
      {showDetail && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
          <p className="font-mono">{getChangeSummary()}</p>
        </div>
      )}
    </div>
  );
}
