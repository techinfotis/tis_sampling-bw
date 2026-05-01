import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, calculateAnalysis, getAllKandangs, getScopedSessions } from '../lib/db';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportToExcel, exportToPDF, getDistribution } from '../lib/utils';

export default function Dashboard() {
  const [selectedKandang, setSelectedKandang] = useState('');
  const [compareKandang, setCompareKandang] = useState('');

  const sessions = useLiveQuery(() => getScopedSessions(), []);
  const kandangs = useLiveQuery(() => getAllKandangs(), []);
  const [kandangTrend, setKandangTrend] = useState([]);
  const [compareTrend, setCompareTrend] = useState([]);
  const [overviewStats, setOverviewStats] = useState(null);

  const kandangList = kandangs?.map(k => k.kode) || [];

  // Calculate overview statistics
  useEffect(() => {
    const calculateOverview = async () => {
      if (!sessions || sessions.length === 0) return;

      const totalSessions = sessions.length;
      const totalKandangs = kandangList.length;
      
      // Hitung total ekor dari semua sesi
      let totalEkor = 0;
      for (const session of sessions) {
        const count = await db.timbang.where('session_id').equals(session.id).count();
        totalEkor += count;
      }

      // Data tren per minggu (agregat semua kandang)
      const trendData = {};
      for (const session of sessions) {
        if (!trendData[session.umur_mg]) {
          trendData[session.umur_mg] = { umur: session.umur_mg, count: 0, totalBerat: 0 };
        }
        const data = await db.timbang.where('session_id').equals(session.id).toArray();
        trendData[session.umur_mg].count += data.length;
        trendData[session.umur_mg].totalBerat += data.reduce((sum, d) => sum + d.berat, 0);
      }

      const trendArray = Object.values(trendData).map(d => ({
        minggu: `Minggu ${d.umur}`,
        rataRata: d.count > 0 ? Math.round(d.totalBerat / d.count) : 0,
        jumlah: d.count
      })).sort((a, b) => parseInt(a.minggu.split(' ')[1]) - parseInt(b.minggu.split(' ')[1]));

      // Data per kandang
      const kandangData = {};
      for (const session of sessions) {
        if (!kandangData[session.kandang]) {
          kandangData[session.kandang] = { kandang: session.kandang, count: 0 };
        }
        const count = await db.timbang.where('session_id').equals(session.id).count();
        kandangData[session.kandang].count += count;
      }

      const kandangArray = Object.values(kandangData);

      setOverviewStats({
        totalSessions,
        totalKandangs,
        totalEkor,
        trendData: trendArray,
        kandangData: kandangArray
      });
    };

    calculateOverview();
  }, [sessions, kandangList]);

  // Calculate trend for selected kandang
  useEffect(() => {
    const calculateKandangTrend = async () => {
      if (!selectedKandang || !sessions) {
        setKandangTrend([]);
        return;
      }

      const kandangSessions = sessions.filter(s => s.kandang === selectedKandang);
      const trendData = {};

      for (const session of kandangSessions) {
        const data = await db.timbang.where('session_id').equals(session.id).toArray();
        if (data.length > 0) {
          const key = session.umur_mg;
          if (!trendData[key]) {
            trendData[key] = {
              minggu: session.umur_mg,
              allWeights: [],
              tanggal: new Date(session.created_at).toLocaleDateString('id-ID')
            };
          }
          // Gabungkan semua berat dari sesi dengan umur yang sama
          trendData[key].allWeights.push(...data.map(d => d.berat));
          // Pakai tanggal terbaru
          const sessionDate = new Date(session.created_at);
          const existingDate = new Date(trendData[key].tanggal.split('/').reverse().join('-'));
          if (sessionDate > existingDate) {
            trendData[key].tanggal = sessionDate.toLocaleDateString('id-ID');
          }
        }
      }

      const trendArray = Object.values(trendData).map(d => {
        const weights = d.allWeights;
        const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
        const lowerBound = mean * 0.9;
        const upperBound = mean * 1.1;
        const uniformCount = weights.filter(w => w >= lowerBound && w <= upperBound).length;
        const uniformity = (uniformCount / weights.length) * 100;
        return {
          minggu: d.minggu,
          rataRata: Math.round(mean),
          totalEkor: weights.length,
          uniformity: uniformity.toFixed(1),
          tanggal: d.tanggal
        };
      }).sort((a, b) => a.minggu - b.minggu);
      setKandangTrend(trendArray);
    };

    calculateKandangTrend();
  }, [selectedKandang, sessions]);

  // Calculate trend for compare kandang
  useEffect(() => {
    const calculateCompareTrend = async () => {
      if (!compareKandang || !sessions) {
        setCompareTrend([]);
        return;
      }

      const kandangSessions = sessions.filter(s => s.kandang === compareKandang);
      const trendData = {};

      for (const session of kandangSessions) {
        const data = await db.timbang.where('session_id').equals(session.id).toArray();
        if (data.length > 0) {
          const totalBerat = data.reduce((sum, d) => sum + d.berat, 0);
          const rataRata = Math.round(totalBerat / data.length);
          
          trendData[session.umur_mg] = {
            minggu: session.umur_mg,
            rataRata,
            totalEkor: data.length
          };
        }
      }

      const trendArray = Object.values(trendData).sort((a, b) => a.minggu - b.minggu);
      setCompareTrend(trendArray);
    };

    calculateCompareTrend();
  }, [compareKandang, sessions]);

  const handleExport = async (format) => {
    if (!selectedKandang || kandangTrend.length === 0) return;
    
    const kandangInfo = kandangs?.find(k => k.kode === selectedKandang);
    
    const metadata = {
      kandangKode: selectedKandang,
      kandangNama: kandangInfo?.nama || `Kandang ${selectedKandang}`,
      penanggungJawab: kandangInfo?.penanggung_jawab || '-',
      kontak: kandangInfo?.kontak || '-',
      kapasitas: kandangInfo?.kapasitas || null,
      totalMinggu: kandangTrend.length,
      totalEkor: kandangTrend.reduce((sum, t) => sum + t.totalEkor, 0),
      rataRataKeseluruhan: Math.round(kandangTrend.reduce((sum, t) => sum + t.rataRata, 0) / kandangTrend.length)
    };
    
    const filename = `Tren_${selectedKandang}_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'excel') {
      exportToExcel(kandangTrend, metadata, `${filename}.csv`);
    } else if (format === 'pdf') {
      exportToPDF(kandangTrend, metadata, `${filename}.pdf`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Dashboard Analitik</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2 font-semibold">Pilih Kandang</label>
            <select 
              className="w-full p-2 border rounded"
              value={selectedKandang}
              onChange={(e) => setSelectedKandang(e.target.value)}
            >
              <option value="">Pilih Kandang</option>
              {kandangList.map(k => {
                const kandangInfo = kandangs?.find(kd => kd.kode === k);
                return (
                  <option key={k} value={k}>
                    {k} - {kandangInfo?.nama || 'Kandang ' + k}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block mb-2 font-semibold">Bandingkan dengan</label>
            <select 
              className="w-full p-2 border rounded"
              value={compareKandang}
              onChange={(e) => setCompareKandang(e.target.value)}
              disabled={!selectedKandang}
            >
              <option value="">Tidak ada</option>
              {kandangList.filter(k => k !== selectedKandang).map(k => {
                const kandangInfo = kandangs?.find(kd => kd.kode === k);
                return (
                  <option key={k} value={k}>
                    {k} - {kandangInfo?.nama || 'Kandang ' + k}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {!selectedKandang ? (
        // Overview Mode - Tampilan default
        <OverviewDashboard stats={overviewStats} kandangs={kandangs} colors={COLORS} />
      ) : (
        // Kandang Trend Mode - Tampilan tren per kandang
        <>
          {kandangTrend.length > 0 && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard 
                  title="Total Minggu" 
                  value={kandangTrend.length} 
                  color="blue" 
                />
                <StatCard 
                  title="Total Ekor" 
                  value={kandangTrend.reduce((sum, t) => sum + t.totalEkor, 0)} 
                  color="green" 
                />
                <StatCard 
                  title="Rata-rata Keseluruhan" 
                  value={`${Math.round(kandangTrend.reduce((sum, t) => sum + t.rataRata, 0) / kandangTrend.length)} gr`} 
                  color="yellow" 
                />
                <StatCard 
                  title="Minggu Terakhir" 
                  value={`Minggu ${kandangTrend[kandangTrend.length - 1]?.minggu || '-'}`} 
                  color="purple" 
                />
              </div>

              {/* Trend Chart */}
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">📈 Tren Pertumbuhan Kandang {selectedKandang}</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleExport('excel')}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                    >
                      📊 Download Excel
                    </button>
                    <button 
                      onClick={() => handleExport('pdf')}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-2"
                    >
                      📄 Download PDF
                    </button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={kandangTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="minggu" 
                      tickFormatter={(value) => `Minggu ${value}`}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => `Minggu ${value}`}
                      formatter={(value, name) => [
                        name === 'rataRata' ? `${value} gram` : 
                        name === 'totalEkor' ? `${value} ekor` :
                        name === 'uniformity' ? `${value}%` : value,
                        name === 'rataRata' ? 'Rata-rata Berat' :
                        name === 'totalEkor' ? 'Total Ekor' :
                        name === 'uniformity' ? 'Keseragaman' : name
                      ]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="rataRata" 
                      stroke="#10b981" 
                      strokeWidth={3} 
                      name="Rata-rata Berat (gr)"
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="uniformity" 
                      stroke="#f59e0b" 
                      strokeWidth={2} 
                      name="Keseragaman (%)"
                      dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                    />
                    {compareKandang && compareTrend.length > 0 && (
                      <Line 
                        type="monotone" 
                        dataKey="rataRataCompare" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        strokeDasharray="5 5"
                        name={`${compareKandang} - Rata-rata (gr)`}
                        data={compareTrend}
                        dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Data Table */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-xl font-bold mb-4">📋 Detail Data per Minggu</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-3 text-left">Minggu</th>
                        <th className="p-3 text-right">Rata-rata Berat</th>
                        <th className="p-3 text-right">Total Ekor</th>
                        <th className="p-3 text-right">Keseragaman</th>
                        <th className="p-3 text-left">Tanggal Timbang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kandangTrend.map((trend) => (
                        <tr key={trend.minggu} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-semibold">Minggu {trend.minggu}</td>
                          <td className="p-3 text-right font-bold text-green-600">{trend.rataRata} gr</td>
                          <td className="p-3 text-right">{trend.totalEkor} ekor</td>
                          <td className="p-3 text-right">{trend.uniformity}%</td>
                          <td className="p-3 text-sm text-gray-600">{trend.tanggal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {kandangTrend.length === 0 && (
            <div className="bg-white p-12 rounded-lg shadow text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Belum Ada Data Timbang</h3>
              <p className="text-gray-500">Kandang {selectedKandang} belum memiliki data timbang.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function OverviewDashboard({ stats, kandangs, colors }) {
  if (!stats) {
    return (
      <div className="bg-white p-12 rounded-lg shadow text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-600 mb-2">Belum Ada Data</h3>
        <p className="text-gray-500">Mulai dengan menambahkan kandang dan melakukan sesi timbang pertama.</p>
      </div>
    );
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Sesi Timbang</p>
              <p className="text-4xl font-bold mt-2">{stats.totalSessions}</p>
            </div>
            <div className="text-blue-200">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Kandang Aktif</p>
              <p className="text-4xl font-bold mt-2">{stats.totalKandangs}</p>
            </div>
            <div className="text-green-200">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Total Ayam Ditimbang</p>
              <p className="text-4xl font-bold mt-2">{stats.totalEkor.toLocaleString()}</p>
            </div>
            <div className="text-purple-200">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tren Berat per Minggu */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold mb-4">📈 Tren Rata-rata Berat per Minggu</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="minggu" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="rataRata" stroke="#10b981" strokeWidth={3} name="Rata-rata (gr)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Distribusi per Kandang */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold mb-4">🏠 Distribusi Timbang per Kandang</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.kandangData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ kandang, count, percent }) => `${kandang}: ${count} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {stats.kandangData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Kandang List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-xl font-bold mb-4">📋 Ringkasan Kandang</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kandangs?.map((kandang, index) => (
            <div key={kandang.id} className="border-2 border-gray-200 rounded-lg p-4 hover:border-green-500 transition">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-bold text-lg">{kandang.kode}</h4>
                  <p className="text-sm text-gray-600">{kandang.nama}</p>
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }}></div>
              </div>
              <div className="text-sm space-y-1">
                <p><span className="text-gray-500">PJ:</span> {kandang.penanggung_jawab}</p>
                <p><span className="text-gray-500">Kontak:</span> {kandang.kontak}</p>
                {kandang.kapasitas && (
                  <p><span className="text-gray-500">Kapasitas:</span> {kandang.kapasitas} ekor</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-500 p-4 rounded">
        <p className="text-sm text-gray-700">
          💡 <strong>Tips:</strong> Pilih kandang dan umur di atas untuk melihat analisa detail dan distribusi berat ayam.
        </p>
      </div>
    </>
  );
}

function StatCard({ title, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    purple: 'bg-purple-50 text-purple-700'
  };

  return (
    <div className={`${colors[color]} p-6 rounded-lg shadow`}>
      <p className="text-sm opacity-80 mb-1">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function CompareCard({ title, value1, value2, label1, label2, unit = '' }) {
  const diff = value1 - value2;
  const diffColor = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600';

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <p className="text-sm font-semibold mb-2">{title}</p>
      <div className="space-y-1">
        <p className="text-lg">{label1}: <span className="font-bold">{value1}{unit}</span></p>
        <p className="text-lg">{label2}: <span className="font-bold">{value2}{unit}</span></p>
        <p className={`text-sm font-semibold ${diffColor}`}>
          Selisih: {diff > 0 ? '+' : ''}{diff.toFixed(2)}{unit}
        </p>
      </div>
    </div>
  );
}
