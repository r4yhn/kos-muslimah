# Spesifikasi Sistem Informasi Manajemen Kos Pondok Muslimah

| Parameter | Detail |
| :--- | :--- |
| **Nama Proyek** | Sistem Informasi Manajemen Kos Pondok Muslimah |
| **Target Pengguna** | Pengelola/Admin (`admin`) & Penghuni (`penghuni`) |
| **Teknologi** | Next.js 16 (App Router), Supabase (PostgreSQL), Drizzle ORM, Auth.js (NextAuth v5), Tailwind CSS, Lucide Icons, `@react-pdf/renderer` |
| **Migrations** | `0000_*` (inti) · `0001_*` (role & bayar-awal) · `0002_*` (notifikasi) · `0003_*` (tagihan: `jatuh_tempo`, tanggal nullable) · `0004_*` (status "Menunggu Konfirmasi", `bukti_pembayaran`, `kelompok_konfirmasi`) |
| **Status Dokumen** | Revisi — disinkronkan dengan implementasi aktual; lihat bagian Roadmap |

> Dokumen ini adalah **PRD hidup**: bagian "Status" di setiap modul mengacu pada
> kode yang sudah berjalan, sedangkan **Roadmap** memuat rencana yang belum dibuat.

---

## 1. Ringkasan & Tujuan

Mentransformasi pencatatan manual Kos Pondok Muslimah menjadi sistem berbasis
web dengan dua area:

- **Panel Admin** (`/dashboard`, `/kamar`, `/penghuni`, `/pembayaran`,
  `/laporan`, `/notifikasi`): master data, pencatatan transaksi, monitoring,
  laporan keuangan, pelaporan PDF.
- **Portal Penghuni** (`/portal`, `/portal/bayar`, `/portal/riwayat`,
  `/portal/notifikasi`): registrasi mandiri, bayar awal & bayar sewa bulanan
  online, melihat status kamar/riwayat, dan menerima notifikasi.

Tujuan utama:
1. **Master Data** — kelola kamar & penghuni dengan status yang konsisten.
2. **Pencatatan Transaksi** — catat pembayaran sewa bulanan (admin maupun
   penghuni mandiri lewat web).
3. **Monitoring** — pantau status kamar dan pembayaran (Lunas/Belum Lunas)
   dengan indikator visual.
4. **Pelaporan** — ekspor laporan pembayaran & status kamar ke PDF.

---

## 2. Arsitektur Data & Skema Database (Drizzle ORM)

Semua skema didefinisikan di `src/db/schema.ts`. Tabel `users`, `kamar`,
`penghuni`, `pembayaran` dibuat oleh migrasi `0000`; kolom `role`,
`id_penghuni`, `perlu_bayar_awal` oleh `0001`; tabel `notifikasi` oleh `0002`;
`0003` (tagihan: `jatuh_tempo`, `tanggal_bayar` nullable); `0004` (status
"Menunggu Konfirmasi", `bukti_pembayaran`, `kelompok_konfirmasi`).

### 2.1 Enum

| Enum | Nilai |
| :--- | :--- |
| `user_role` | `admin`, `penghuni` |
| `status_kamar` | `Tersedia`, `Terisi`, `Perbaikan` |
| `status_penghuni` | `Aktif`, `Keluar` |
| `status_bayar` | `Lunas`, `Menunggu Konfirmasi`, `Belum Lunas` |

### 2.2 Table `users`

Akun login semua pengguna (admin & penghuni).

* `id`: `uuid` (PK, `gen_random_uuid()`)
* `name`: `varchar(255)`
* `email`: `varchar(255)` (Unique)
* `password`: `text` (hash bcrypt)
* `role`: `user_role` (default `admin`) — peran akun
* `id_penghuni`: `uuid` (Unique, nullable, FK → `penghuni.id` ON DELETE
  CASCADE) — menautkan akun penghuni ke datanya
* `created_at`: `timestamp with time zone`

### 2.3 Table `kamar`

* `id`: `uuid` (PK)
* `no_kamar`: `varchar(50)` (Unique)
* `tipe_kamar`: `varchar(100)` (mis. Standard, VIP)
* `harga_sewa`: `integer` (rupiah/bulan)
* `status_kamar`: `status_kamar` (default `Tersedia`)
* `created_at`: `timestamp with time zone`

### 2.4 Table `penghuni`

* `id`: `uuid` (PK)
* `id_kamar`: `uuid` (FK → `kamar.id` ON DELETE SET NULL, nullable)
* `nama`: `varchar(255)`
* `jenis_kelamin`: `varchar(20)`
* `alamat`: `text`
* `no_hp`: `varchar(20)`
* `tgl_masuk`: `date`
* `status`: `status_penghuni` (default `Aktif`)
* `perlu_bayar_awal`: `boolean` (default `false`) — aturan "Bayar di Awal";
  `true` = penghuni baru belum melunasi sewa pertama, menu portal terkunci
* `created_at`: `timestamp with time zone`

### 2.5 Table `pembayaran`

Satu baris per penghuni per bulan sewa (periodik). Tidak ada kolom "jenis"
pembayaran — pembayaran awal vs bulanan dibedakan lewat `keterangan`.

* `id`: `uuid` (PK)
* `id_penghuni`: `uuid` (FK → `penghuni.id` ON DELETE CASCADE)
* `tanggal_bayar`: `date` (nullable; diisi saat pembayaran benar-benar terjadi,
  tagihan otomatis yang belum dibayar bernilai `null`)
* `jatuh_tempo`: `date` (nullable) — batas akhir bayar tagihan; diisi otomatis
  oleh sistem saat tagihan "Belum Lunas" diterbitkan (tanggal 5 bulan berjalan)
* `bulan`: `integer` 1–12 (check constraint)
* `tahun`: `integer`
* `jumlah_bayar`: `integer`
* `metode_bayar`: `varchar(50)` (panel: Cash/Transfer/E-Wallet/Lainnya;
  online: Transfer Bank/Virtual Account/QRIS/E-Wallet)
* `bukti_pembayaran`: `text` (nullable) — data URL gambar bukti transfer/QRIS
  untuk pengajuan "Menunggu Konfirmasi"
* `kelompok_konfirmasi`: `uuid` (nullable) — mengelompokkan beberapa bulan
  dalam satu pengajuan yang diverifikasi admin sekaligus
* `keterangan`: `text` (opsional) — membedakan jenis: "Pembayaran Awal…",
  "Pembayaran Sewa Bulanan Online…", "Tagihan Sewa Bulanan…"
* `status_bayar`: `status_bayar` — "Belum Lunas" = tagihan; "Menunggu
  Konfirmasi" = bukti terkirim menanti verifikasi; "Lunas" = selesai
* `created_at`: `timestamp with time zone`
* Indeks: `(bulan, tahun)`.

### 2.6 Table `notifikasi`

* `id`: `uuid` (PK)
* `id_user`: `uuid` (FK → `users.id` ON DELETE CASCADE)
* `judul`: `varchar(255)`
* `pesan`: `text`
* `dibaca`: `boolean` (default `false`)
* `created_at`: `timestamp with time zone`
* Indeks: `(id_user)`.

### 2.7 Relasi & aturan data penting

- `penghuni → kamar`: satu kamar dapat ditempati banyak penghuni (historis),
  tetapi di praktik alur kamar hanya menampung penghuni aktif; status kamar
  dikelola otomatis dari status penghuni.
- `users.id_penghuni` unik → satu akun untuk satu penghuni; menghapus
  penghuni menghapus akunnya (CASCADE).
- Menghapus penghuni hanya boleh jika belum punya riwayat pembayaran.
- Kamar hanya bisa dihapus jika tidak ada penghuni (aktif/keluar) yang
  menautkannya.

---

## 3. Autentikasi, Peran & Alur Utama

### 3.1 Autentikasi (Auth.js v5)

- Login email+password (`/login`) memakai `CredentialsProvider`; sesi JWT.
- Seluruh route aplikasi (kecuali `/login`, `/daftar`, `/daftar-penghuni`, aset)
  diproteksi Proxy (`src/proxy.ts`; Next.js 16) via callback `authorized` di
  `src/auth.ts`.
  - `/daftar` → registrasi mandiri penghuni **baru** (pilih kamar + Bayar Awal).
  - `/daftar-penghuni` → aktivasi akun mandiri penghuni yang **sudah terdata**
    pengelola tetapi belum punya akun (email/password sendiri).
- Admin hanya boleh mengakses panel `/dashboard`, `/kamar`, `/penghuni`,
  `/pembayaran`, `/laporan`, `/notifikasi`; penghuni hanya `/portal*`. Jika
  menyeberang, sistem mengalihkan ke beranda masing-masing peran.
- JWT lama tanpa klaim role diperlakukan sebagai `admin` (perilaku historis).

### 3.2 Peran

| Peran | Beranda | Kemampuan |
| :--- | :--- | :--- |
| `admin` | `/dashboard` | Kelola kamar/penghuni/pembayaran, konfirmasi (lihat roadmap), laporan keuangan & export PDF, lihat notifikasi |
| `penghuni` | `/portal` | Bayar awal, bayar sewa bulanan online, lihat riwayat & notifikasi |

### 3.3 Alur A — Registrasi & "Bayar di Awal" (penghuni baru)

1. `/daftar`: penghuni isi identitas + pilih kamar **Tersedia** yang tidak
   sedang dipesan orang lain, lalu buat email & password sendiri.
2. Sistem membuat `penghuni` (`perlu_bayar_awal = true`) + akun `role:
   penghuni` tertaut (`users.id_penghuni`), dan memberi notifikasi ke admin.
3. Auto-login → karena `perlu_bayar_awal`, seluruh menu portal terkunci dan
   hanya `/portal/bayar-awal` yang tersedia.
4. Penghuni pilih paket **1/2/6 bulan** (total = harga sewa × jumlah bulan;
   metode Transfer Bank/Virtual Account/QRIS/E-Wallet). Setiap bulan dicatat
   `pembayaran` **Lunas** terpisah mulai periode `tgl_masuk`.
5. Begitu bulan pertama Lunas → `perlu_bayar_awal = false`, kamar resmi
   **Terisi**, menu portal terbuka, notifikasi ke penghuni & admin.
6. Kamar yang menunggu pembayaran awal tidak bisa dipesan penghuni lain
   (dicek di `lib/kamar-options.ts` dan semua server action).

### 3.4 Alur B — "Bayar Sewa Bulanan" online (penghuni aktif)

1. Penghuni yang sudah tidak terkunci membuka `/portal/bayar` (menu **Bayar
   Sewa**).
2. Sistem menghitung tagihan belum Lunas = bulan `tgl_masuk` s.d. **bulan
   berjalan** yang belum punya baris `Lunas` (`lib/bayar-bulanan.ts`).
   Tagihan baru muncul otomatis tiap awal bulan.
3. Penghuni memilih satu/beberapa bulan tagihan + metode online + tanggal
   bayar; total = harga sewa × jumlah bulan.
4. Server mencatat Lunas per bulan dalam satu transaksi (baris "Belum Lunas"
   buatan admin ikut diperbarui) dan mengirim notifikasi penghuni & admin.
5. Penghuni yang masih `perlu_bayar_awal` dialihkan ke `/portal/bayar-awal`.

---

## 4. Modul Fitur & Status Implementasi

Status: ✅ berjalan · 🔶 sebagian (lihat catatan) · ⏳ roadmap.

### 🔑 Module 1: Autentikasi & Peran
- ✅ Login credentials, proteksi route per peran, logout.
- ✅ Registrasi mandiri penghuni (`/daftar`) + pembuatan akun oleh admin saat
  mendaftarkan penghuni (email/password opsional di form penghuni).
- ✅ Aktivasi akun mandiri penghuni yang sudah terdata (`/daftar-penghuni`):
  verifikasi Nomor HP/WA → buat email (username) & password sendiri → auto-login
  ke portal (akun tertaut `users.id_penghuni`; notifikasi ke admin).
- 🔶 Belum ada: lupa/ubah password, kelola profil sendiri (lihat Roadmap-2D).

### 📊 Module 2: Dashboard Admin (`/dashboard`)
- ✅ Kartu statistik: total kamar (Terisi/Tersedia/Perbaikan), penghuni aktif,
  pembayaran bulan berjalan (Lunas/Belum Lunas + nominal).
- ✅ Quick-alert tabel penghuni aktif tanpa pembayaran Lunas bulan berjalan.
- ✅ Indikator "tagihan lewat jatuh tempo" (jumlah & nominal) di kartu
  pembayaran + penanda per penghuni di quick-alert.
- ✅ Tren pendapatan, piutang, & tunggakan: halaman **Laporan Keuangan**
  (`/laporan`) menyajikan rekap per bulan, per metode bayar, sorotan keuangan,
  dan daftar tunggakan per penghuni — lihat Module 9 & Roadmap-3F.

### 🚪 Module 3: Kelola Kamar (`/kamar`)
- ✅ CRUD kamar + export PDF status kamar.
- ✅ Otomasi status: Terisi saat penghuni terdaftar (setelah bayar awal),
  Tersedia kembali saat penghuni keluar; admin bisa set "Perbaikan"/manual
  selama kamar tidak terisi penghuni aktif.
- ✅ Visual badges (dot + label, sesuai aksesibilitas DESIGN.MD).

### 👤 Module 4: Kelola Penghuni (`/penghuni`)
- ✅ CRUD penghuni; pilihan kamar hanya yang benar-benar bisa ditempati
  (`lib/kamar-options.ts`), termasuk blokir kamar yang menunggu bayar awal.
- ✅ Pencarian nama/no. kamar; aksi "keluar" mengosongkan kamar otomatis.
- ✅ Penanda penghuni "Menunggu Bayar Awal".
- ⏳ Pagination untuk data banyak (Roadmap-3H).

### 💳 Module 5: Pencatatan & Monitoring Pembayaran (`/pembayaran`)
- ✅ Catat/edit/hapus pembayaran sewa per penghuni per bulan/tahun dengan
  status Lunas/Belum Lunas, jumlah, metode, tanggal, keterangan.
- ✅ Filter monitoring bulan/tahun/status + ringkasan total & total Lunas.
- ✅ Baris "Belum Lunas" yang dicatat admin ikut dilunasi saat penghuni bayar
  online (server action `simpanPembayaranBulanan`).
- ✅ Auto-generate tagihan bulanan + jatuh tempo (fitur 1A): halaman admin &
  dashboard memicu penerbitan tagihan "Belum Lunas" untuk bulan berjalan;
  ada pula endpoint `/api/cron/generate-tagihan` untuk penjadwalan. Tagihan
  yang dibayar (online/admin) melunasi baris yang sama.
- ✅ Verifikasi pembayaran online (fitur 1B): status "Menunggu Konfirmasi"
  di portal (`/portal/bayar` & `/portal/bayar-awal`) dengan upload bukti
  (gambar ≤ 2 MB); panel Pembayaran menampilkan kartu verifikasi per
  pengajuan — Terima → Lunas (kunci bayar-awal dibuka), Tolak → kembali
  menjadi tagihan — plus notifikasi ke penghuni.
- ⏳ Denda keterlambatan & biaya lain (listrik/air); pengaturan hari jatuh
  tempo per kamar.

### 📥 Module 6: Export Laporan PDF
- ✅ Laporan pembayaran (`/api/laporan/pembayaran`) mengikuti filter aktif.
- ✅ Laporan status kamar (`/api/laporan/status-kamar`).
- ✅ Laporan keuangan (`/api/laporan/keuangan?tahun=&dari=&sampai=`) — ringkasan
  pendapatan/piutang, rekap per bulan, pendapatan per metode bayar, dan daftar
  tunggakan per penghuni.
- ⏳ Kartu tagihan per penghuni & filter export lebih kaya (Roadmap-3G).

### 🏠 Module 7: Portal Penghuni (`/portal*`)
- ✅ Beranda status kamar/biaya/tanggal masuk; badge status.
- ✅ `/portal/bayar-awal` — paket 1/2/6 bulan; pengajuan + upload bukti
  (menunggu verifikasi admin, kamar aktif setelah Lunas).
- ✅ `/portal/bayar` — ajukan pembayaran tagihan bulanan belum Lunas dengan
  bukti; daftar pengajuan "Menunggu Konfirmasi" dapat dibatalkan penghuni.
- ✅ `/portal/riwayat` — daftar pembayaran milik sendiri (terbaru di atas).
- ✅ `/portal/notifikasi` — baca/tandai semua.
- ⏳ Pengumuman/kontak admin, profil & ubah password (Roadmap-2D/2E).

### 🔔 Module 8: Notifikasi
- ✅ Tabel `notifikasi` + lonceng di panel & portal (badge belum dibaca).
- ✅ Otomatis: penghuni baru mendaftar, pembayaran awal/bulanan berhasil
  (notifikasi penghuni + seluruh admin via `kirimNotifikasiKeRole`).
- ⏳ Pengingat tagihan menjelang jatuh tempo (Roadmap-2C).

### 📈 Module 9: Laporan Keuangan (`/laporan`)
- ✅ Kartu ringkasan periode: **Pendapatan (Lunas)**, **Piutang (Belum Lunas)**
  + nilai lewat jatuh tempo, **Menunggu Konfirmasi**, dan **rata-rata
  pendapatan per bulan** (jumlah penghuni aktif sebagai konteks).
- ✅ Filter **tahun + rentang bulan** (`dari` s.d. `sampai`) sehingga bisa
  dipakai untuk laporan bulanan, kuartalan, maupun setahun penuh.
- ✅ Tabel **Rekap Pendapatan per Bulan**: jumlah transaksi, nominal Lunas
  (dengan bar proporsi antar-bulan), tagihan Belum Lunas, pengajuan Menunggu
  Konfirmasi, total seluruh status, plus baris total.
- ✅ **Pendapatan per metode bayar** (Cash/Transfer/QRIS/dll.) beserta porsi
  terhadap total pendapatan.
- ✅ **Sorotan keuangan**: bulan pendapatan tertinggi, rasio piutang terhadap
  pendapatan, tagihan lewat jatuh tempo, dan jumlah penghuni bertunggakan.
- ✅ **Tunggakan per penghuni** (nominal terbesar lebih dahulu) lengkap dengan
  kamar, jumlah bulan, jatuh tempo terawal, status lewat/belum jatuh tempo,
  serta tautan tindak lanjut ke `/pembayaran?bulan=&tahun=&status=Belum Lunas`.
- ✅ Export PDF `/api/laporan/keuangan` mengikuti filter aktif (2 halaman:
  ringkasan + rekap bulanan, lalu per metode bayar + tunggakan).
- ✅ Dapat dibuka dari navbar panel ("Laporan Keuangan"), dari tombol di halaman
  Pembayaran (meneruskan filter tahun aktif), dan dari tautan pada kartu
  Pembayaran di dashboard.
- ⏳ Belum ada: grafik tren multi-tahun, biaya operasional/pengeluaran, dan
  denda keterlambatan (agar laporan menjadi laba/rugi penuh).

### 🗄️ Struktur kode penting
```
src/
├─ auth.ts, proxy.ts          # Auth.js + proteksi route (Next.js 16)
├─ db/schema.ts               # Skema Drizzle
├─ lib/
│  ├─ bayar-awal.ts           # Aturan Bayar di Awal + paket 1/2/6 bulan
│  ├─ bayar-bulanan.ts        # Tagihan & pembayaran bulanan portal
│  ├─ tagihan.ts              # Auto-generate tagihan + jatuh tempo (1A)
│  ├─ keuangan.ts             # Rekap laporan keuangan (per bulan/metode/tunggakan)
│  ├─ kamar-options.ts        # Kamar yang benar-benar bisa ditempati
│  ├─ notifikasi.ts, portal.ts
│  └─ ui.ts, format.ts, laporan.tsx
└─ app/
   ├─ (panel)/…               # Admin (dashboard, kamar, penghuni, pembayaran,
   │                          #   laporan, notifikasi)
   ├─ daftar/                 # Registrasi mandiri penghuni baru (publik)
   ├─ daftar-penghuni/        # Aktivasi akun portal penghuni terdata (publik)
   ├─ portal/…                # Portal penghuni
   └─ api/laporan/…           # Route PDF (pembayaran, status-kamar, keuangan)
```

---

## 5. Keterbatasan Saat Ini (diketahui)

1. **Pembayaran online belum terhubung payment gateway** — alurnya berbasis
   upload bukti ("Menunggu Konfirmasi") lalu diverifikasi manual admin.
   Integrasi Midtrans/Xendit dengan status otomatis bisa menggantikan langkah
   manual tersebut.
2. **Penjadwalan otomatis platform belum dipasang** — tagihan dibuat saat
   halaman admin/dashboard dibuka dan bisa dipicu via
   `/api/cron/generate-tagihan`, tetapi cron platform (mis. Vercel, tiap
   tanggal 1) belum dikonfigurasi. Hari jatuh tempo juga masih seragam
   (tanggal 5 tiap bulan), belum bisa diatur per kamar.
3. **Belum ada ubah/lupa password & halaman profil** untuk kedua peran.
4. **Belum ada pagination** di daftar penghuni/pembayaran/riwayat.
5. **Belum ada pengingat eksternal** (email/WhatsApp) — notifikasi hanya
   internal aplikasi.
6. **Belum ada audit trail** siapa yang mencatat/mengubah pembayaran.

---

## 6. Roadmap

Urutan rekomendasi — dari nilai tertinggi & risiko paling kecil.

### Tahap 1 — Melengkapi Modul Pembayaran
- **1A. Auto-generate tagihan bulanan & jatuh tempo** ✅ *selesai* (migrasi
  `0003`, helper `lib/tagihan.ts`, indikator lewat jatuh tempo di dashboard,
  dan endpoint `/api/cron/generate-tagihan`). Lanjutan opsional: hari jatuh
  tempo per kamar & pasang cron platform.
- **1B. Status pembayaran berjenjang + bukti** ✅ *selesai* — nilai enum
  `Menunggu Konfirmasi`, kolom `bukti_pembayaran` & `kelompok_konfirmasi`,
  upload bukti di kedua alur portal, kartu verifikasi admin (Terima/Tolak),
  batalkan pengajuan, dan notifikasi hasil. Lanjutan opsional: integrasi
  payment gateway (Midtrans/Xendit) agar verifikasi otomatis.

### Tahap 2 — Komunikasi & Kemudahan Penghuni
- **2C. Pengingat tagihan** (notifikasi internal; siap integrasi email/WA).
- **2D. Ubah password & kelola profil** di portal penghuni & panel admin
  (termasuk ganti email).
- **2E. Pengumuman/kontak**: admin menulis info; penghuni melihatnya di
  portal.

### Tahap 3 — Pelaporan & Kinerja
- **3F. Dashboard analitis** 🔶 *sebagian* — halaman **Laporan Keuangan**
  (`/laporan`) menyajikan tren pendapatan per bulan, rekap per metode bayar,
  sorotan piutang, dan daftar tunggakan (top tunggakan) + export PDF. Sisa:
  grafik tren antar-tahun & rasio okupansi historis.
- **3G. Kartu tagihan PDF per penghuni** & filter export lebih kaya. (Filter
  export keuangan sudah ada di `/api/laporan/keuangan`.)
- **3H. Pagination** halaman penghuni/pembayaran/riwayat.
- **3I. Log aktivitas (audit trail)** untuk perubahan data sensitif.

### Tahap 4 — Dokumentasi & Pengujian
- **4J. Unit/E2E test** untuk aturan bayar-awal & bayar bulanan, seed data
  demo lengkap.
- **4K. Sinkronisasi README/DESIGN** bila ada perubahan alur.

---

## 7. Menjalankan

```bash
npm install
cp .env.example .env      # isi DATABASE_URL, AUTH_SECRET, dll.
npm run db:migrate        # terapkan 0000–0002 (wajib, lihat migrasi)
npm run db:seed           # buat akun admin (SEED_ADMIN_*)
npm run dev               # http://localhost:3000
```

| Script | Fungsi |
| :--- | :--- |
| `npm run dev` / `npm run build` / `npm run start` | Dev / build produksi / start |
| `npm run lint` | ESLint |
| `npm run db:generate` / `db:migrate` / `db:push` / `db:seed` | Migrasi & seed |
| `npm run db:studio` | Drizzle Studio |
