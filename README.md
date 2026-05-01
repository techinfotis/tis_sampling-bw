# Smart Farm Layer 4.0 – Timbang Ayam Farm

Aplikasi timbang berat ayam dengan analitik untuk desktop dan mobile (PWA).

## Fitur Utama

### Manajemen Kandang
- Pendaftaran kandang baru dengan kode unik
- Data penanggung jawab dan kontak
- Kapasitas kandang
- Edit dan hapus data kandang

### Mobile (PWA)
- Input berat per ekor secara cepat
- Auto-detect umur ayam dari histori kandang
- Tampilan info penanggung jawab kandang
- Offline caching dengan Workbox
- Review & analisa data sebelum simpan

### Desktop Dashboard
- Filter dinamis per kandang dan umur
- Kartu ringkasan: Total Ekor, Rata-rata, Keseragaman, CV
- Grafik distribusi berat ayam
- Perbandingan antar kandang
- Export data ke CSV

## Teknologi

- **Frontend**: React + Vite
- **Database Lokal**: Dexie (IndexedDB)
- **Database Cloud**: Supabase
- **Charts**: Recharts
- **Styling**: Tailwind CSS
- **PWA**: Vite PWA Plugin + Workbox

## Instalasi

```bash
npm install
```

## Konfigurasi

1. Copy `.env.example` ke `.env`
2. Isi kredensial Supabase:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Development

```bash
npm run dev
```

## Build Production

```bash
npm run build
```

## Struktur Database

### IndexedDB (Lokal)
- **kandangs**: Menyimpan data kandang (kode, nama, penanggung jawab, kontak, kapasitas)
- **sessions**: Menyimpan sesi timbang (kandang, umur, timestamp)
- **timbang**: Menyimpan data berat per ekor

### Supabase Schema (Opsional)

```sql
-- Tabel kandangs
CREATE TABLE kandangs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kode VARCHAR(10) UNIQUE NOT NULL,
  nama VARCHAR(100) NOT NULL,
  penanggung_jawab VARCHAR(100) NOT NULL,
  kontak VARCHAR(50) NOT NULL,
  kapasitas INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabel sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kandang VARCHAR(10) NOT NULL,
  umur_mg INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  synced BOOLEAN DEFAULT FALSE
);

-- Tabel timbang
CREATE TABLE timbang (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id),
  id_ayam INTEGER NOT NULL,
  berat INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Analisa Statistik

- **Mean (Rata-rata)**: Jumlah total berat ÷ jumlah ayam
- **Uniformity (Keseragaman)**: Persentase ayam dalam range ±10% dari rata-rata
- **CV (Coefficient of Variation)**: (Standar Deviasi ÷ Rata-rata) × 100%
- **Distribution**: Histogram distribusi berat dengan bin 100 gram

## Roadmap

- [ ] Sinkronisasi otomatis ke Supabase
- [ ] Grafik tren mingguan multi-line
- [ ] Notifikasi offline/online status
- [ ] Export PDF report
- [ ] Multi-user authentication
