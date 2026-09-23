# Spesifikasi Sistem Informasi Manajemen Kos Pondok Muslimah

| Parameter | Detail |
| :--- | :--- |
| **Nama Proyek** | Sistem Informasi Manajemen Kos Pondok Muslimah |
| **Target Pengguna** | Pemilik Kos (`pemilik`, pemantauan read-only), Pengelola/Admin (`admin`) & Penghuni (`penghuni`) |
| **Teknologi** | Next.js 16 (App Router), Supabase (PostgreSQL), Drizzle ORM, Auth.js (NextAuth v5), Tailwind CSS, Lucide Icons, `@react-pdf/renderer` |
| **Migrations** | `0000_*` (inti) · `0001_*` (role & bayar-awal) · `0002_*` (notifikasi) · `0003_*` (tagihan: `jatuh_tempo`, tanggal nullable) · `0004_*` (status "Menunggu Konfirmasi", `bukti_pembayaran`, `kelompok_konfirmasi`) · `0005_*` (`transaksi_online` / Midtrans) · `0006_*` (peran `pemilik` + tabel & enum `pengaduan`) · `0007_*` (arsip otomatis: tabel `arsip_penghuni` + enum `alasan_arsip`) |
| **Status Dokumen** | Revisi — disinkronkan dengan implementasi aktual; lihat bagian Roadmap |

> Dokumen ini adalah **PRD hidup**: bagian "Status" di setiap modul mengacu pada
> kode yang sudah berjalan, sedangkan **Roadmap** memuat rencana yang belum dibuat.

---

## 1. Ringkasan & Tujuan

Mentransformasi pencatatan manual Kos Pondok Muslimah menjadi sistem berbasis
web dengan dua area:

- **Panel Admin** (`/dashboard`, `/kamar`, `/penghuni`, `/arsip`, `/pembayaran`,
  `/pengaduan`, `/laporan`, `/notifikasi`): master data, pencatatan transaksi,
  monitoring, penanganan pengaduan, arsip mantan penghuni, laporan keuangan,
  pelaporan PDF.
- **Portal Penghuni** (`/portal`, `/portal/bayar`, `/portal/riwayat`,
  `/portal/pengaduan`, `/portal/notifikasi`): registrasi mandiri, bayar awal &
  bayar sewa bulanan online, melihat status kamar/riwayat, melaporkan kendala
  kamar (pengaduan), dan menerima notifikasi.
- **Area Pemantauan Pemilik Kos** (`/monitoring`, `/monitoring/kamar`,
  `/monitoring/penghuni`, `/monitoring/pembayaran`, `/monitoring/pengaduan`,
  `/monitoring/laporan`): pemantauan **read-only** bagi Pemilik Kos yang sedang
  di luar kota — ringkasan kamar & penghuni, pendapatan/pembayaran, laporan
  keuangan, serta tabel pengaduan penghuni beserta status penanganannya, tanpa
  kemampuan menambah/mengubah/menghapus data.

Tujuan utama:
1. **Master Data** — kelola kamar & penghuni dengan status yang konsisten.
2. **Pencatatan Transaksi** — catat pembayaran sewa bulanan (admin maupun
   penghuni mandiri lewat web).
3. **Monitoring** — pantau status kamar dan pembayaran (Lunas/Belum Lunas)
   dengan indikator visual.
4. **Pelaporan** — ekspor laporan pembayaran & status kamar ke PDF.
5. **Transparansi & Pengawasan** — kanal pengaduan kendala kamar bagi penghuni
   (`pending` → `diproses` → `selesai`) yang penanganannya dilakukan admin dan
   dapat dipantau Pemilik Kos secara read-only untuk mengontrol kinerja
   pengelola.

---

## 2. Arsitektur Data & Skema Database (Drizzle ORM)

Semua skema didefinisikan di `src/db/schema.ts`. Tabel `users`, `kamar`,
`penghuni`, `pembayaran` dibuat oleh migrasi `0000`; kolom `role`,
`id_penghuni`, `perlu_bayar_awal` oleh `0001`; tabel `notifikasi` oleh `0002`;
`0003` (tagihan: `jatuh_tempo`, `tanggal_bayar` nullable); `0004` (status
"Menunggu Konfirmasi", `bukti_pembayaran`, `kelompok_konfirmasi`); `0005`
(`transaksi_online` untuk pembayaran Midtrans); `0006` (nilai enum `pemilik`
pada `user_role` + tabel `pengaduan` dan enum `status_pengaduan`); `0007`
(tabel `arsip_penghuni` + enum `alasan_arsip` untuk fitur **Arsip Otomatis &
Pengosongan Kamar**).

### 2.1 Enum

| Enum | Nilai |
| :--- | :--- |
| `user_role` | `admin`, `pemilik`, `penghuni` |
| `status_kamar` | `Tersedia`, `Terisi`, `Perbaikan` |
| `status_penghuni` | `Aktif`, `Keluar` |
| `status_bayar` | `Lunas`, `Menunggu Konfirmasi`, `Belum Lunas` |
| `status_pengaduan` | `pending`, `diproses`, `selesai` |
| `alasan_arsip` | `Proses Keluar`, `Habis Masa Sewa` |

### 2.2 Table `users`

Akun login semua pengguna (admin & penghuni).

* `id`: `uuid` (PK, `gen_random_uuid()`)
* `name`: `varchar(255)`
* `email`: `varchar(255)` (Unique)
* `password`: `text` (hash bcrypt)
* `role`: `user_role` (default `admin`) — peran akun: `admin` (pengelola,
  akses penuh panel), `pemilik` (Pemilik Kos, pemantauan read-only
  `/monitoring`), `penghuni` (portal mandiri)
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

### 2.7 Table `pengaduan`

Modul **Pengaduan & Laporan Kendala** (migrasi `0006`): penghuni melaporkan
kendala kamar, admin memverifikasi di lapangan & memperbarui status, pemilik
memantau secara read-only.

* `id_pengaduan`: `uuid` (PK, `gen_random_uuid()`)
* `id_penghuni`: `uuid` (FK → `penghuni.id` ON DELETE CASCADE) — pelapor
* `deskripsi_kendala`: `text` — uraian kendala kamar dari penghuni
* `tanggal_lapor`: `date` (default `now()`) — tanggal laporan dibuat
* `status_penyelesaian`: `status_pengaduan` (default `pending`) — `pending`
  (baru, menunggu verifikasi) · `diproses` (sedang ditangani) · `selesai`
  (tuntas)
* `catatan_admin`: `text` (nullable) — hasil verifikasi lapangan/tindakan
  pengelola; wajib diisi saat status diubah ke `diproses`/`selesai` sebagai
  bukti penanganan (dibaca penghuni & Pemilik Kos)
* `ditangani_pada`: `timestamp with time zone` (nullable) — waktu status
  terakhir diperbarui pengelola
* `created_at`: `timestamp with time zone`
* Indeks: `(id_penghuni)`, `(status_penyelesaian)`.

### 2.8 Table `arsip_penghuni`

Modul **Arsip Otomatis & Pengosongan Kamar** (migrasi `0007`): pusat informasi
seluruh mantan penghuni. Setiap penghuni yang keluar dibuatkan **snapshot** di
tabel ini sebelum kamarnya dikosongkan — tidak ada data yang dihapus permanen
(baris `penghuni` & `pembayaran` tetap tersimpan untuk laporan keuangan).

* `id`: `uuid` (PK)
* `id_penghuni`: `uuid` (nullable, FK → `penghuni.id` ON DELETE SET NULL) —
  tautan ke data penghuni asal; snapshot tetap utuh walau data asal dihapus
* `nama`, `jenis_kelamin`, `alamat`, `no_hp`: salinan identitas saat keluar
* `no_kamar`, `tipe_kamar`, `harga_sewa`: keterangan kamar yang ditinggalkan
* `tgl_masuk`: `date` — awal menghuni
* `tgl_keluar`: `date` — tanggal data dipindahkan ke arsip
* `alasan`: `alasan_arsip` — `Proses Keluar` (diproses pengelola / diajukan
  penghuni lewat portal) · `Habis Masa Sewa` (terdeteksi otomatis: tagihan
  sewa sudah lewat jatuh tempo & belum dilunasi)
* `jumlah_pembayaran`, `total_pembayaran`, `total_tunggakan`: ringkasan
  keuangan yang dibekukan saat keluar
* `periode_terakhir`: `varchar(50)` — periode terakhir yang sudah Lunas,
  mis. "September 2026"
* `riwayat_pembayaran`: `jsonb` — salinan seluruh riwayat pembayaran
  (`bulan`, `tahun`, `jumlah_bayar`, `status_bayar`, `metode_bayar`,
  `keterangan`, `tanggal_bayar`, `jatuh_tempo`)
* `catatan`: `text` (nullable) — catatan keluar dari pengelola / keterangan
  sistem (mis. keluar lewat *logout* portal) atau penjelasan default sesuai
  alasan
* `created_at`: `timestamp with time zone`
* Indeks: `(id_penghuni)`, `(tgl_keluar)`.

Helper & aturan: `src/lib/arsip.ts` (`arsipkanPenghuni`, `labelPeriode`,
`jumlahHariPeriode`, `tanggalJatuhTempoPeriode`, `hariPembayaranPenghuni`,
`jatuhTempoTiba`, `sinkronkanArsipPenghuni`, `daftarArsipPenghuni`,
`ringkasanArsip`).

### 2.9 Relasi & aturan data penting

- `penghuni → kamar`: satu kamar dapat ditempati banyak penghuni (historis),
  tetapi di praktik alur kamar hanya menampung penghuni aktif — **maksimal 2
  penghuni aktif per kamar** (aturan aplikasi `lib/kapasitas-kamar.ts`,
  `KAPASITAS_KAMAR = 2`); status kamar dikelola otomatis dari status penghuni.
  Setiap penghuni (termasuk yang berbagi kamar) memiliki akun `users` sendiri.
- `users.id_penghuni` unik → satu akun untuk satu penghuni; menghapus
  penghuni menghapus akunnya (CASCADE).
- Menghapus penghuni hanya boleh jika belum punya riwayat pembayaran.
- Kamar hanya bisa dihapus jika tidak ada penghuni (aktif/keluar) yang
  menautkannya.
- **Arsip penghuni tidak pernah menghapus data**: baris `penghuni` tetap ada
  (status `Keluar`, `id_kamar` = NULL) dan baris `pembayaran` tetap utuh
  sehingga laporan keuangan historis tidak berubah; snapshot `arsip_penghuni`
  adalah salinan beku untuk keperluan keterangan/audit. Satu penghuni hanya
  boleh punya satu baris arsip (proses pengarsipan idempotent).

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
  `/arsip`, `/pembayaran`, `/pengaduan`, `/laporan`, `/notifikasi`; pemilik
  hanya `/monitoring*` (read-only); penghuni hanya `/portal*`. Jika menyeberang,
  sistem mengalihkan ke beranda masing-masing peran (`lib/role.ts`).
- JWT lama tanpa klaim role diperlakukan sebagai `admin` (perilaku historis).

### 3.2 Peran

| Peran | Beranda | Kemampuan |
| :--- | :--- | :--- |
| `admin` | `/dashboard` | Kelola kamar/penghuni/pembayaran, tangani pengaduan (verifikasi lapangan + ubah status), laporan keuangan & export PDF, lihat notifikasi, **kelola akun staf** (`/akun`), ubah profil & password akun sendiri (`/profil`) |
| `pemilik` | `/monitoring` | **Read-only** untuk data kos: ringkasan kamar & kamar terisi, jumlah penghuni, pendapatan/pembayaran, laporan keuangan, tabel pengaduan + status penanganannya. Tidak ada aksi tambah/ubah/hapus pada data utama (server action mutasi menolak role ini); hanya **akun sendiri** yang bisa diubah (`/monitoring/profil`) |
| `penghuni` | `/portal` | Bayar awal, bayar sewa bulanan online, lihat riwayat & notifikasi, kirim pengaduan kendala kamar |

### 3.3 Alur A — Registrasi & "Bayar di Awal" (penghuni baru)

1. `/daftar`: penghuni isi identitas + pilih kamar yang **masih punya slot**
   (maksimal **2 penghuni per kamar**), lalu buat email & password sendiri.
2. Sistem membuat `penghuni` (`perlu_bayar_awal = true`) + akun `role:
   penghuni` tertaut (`users.id_penghuni`), dan memberi notifikasi ke admin.
3. Auto-login → karena `perlu_bayar_awal`, seluruh menu portal terkunci dan
   hanya `/portal/bayar-awal` yang tersedia.
4. Penghuni pilih paket **1/2/6 bulan** (total = harga sewa × jumlah bulan;
   metode Transfer Bank/Virtual Account/QRIS/E-Wallet) dengan bukti bayar.
   Setiap bulan dicatat `pembayaran` **Lunas** terpisah mulai periode
   `tgl_masuk` — status berubah otomatis (tanpa antrean verifikasi).
5. Begitu bulan pertama Lunas → `perlu_bayar_awal = false`, kamar resmi
   **Terisi**, menu portal terbuka, notifikasi ke penghuni & admin.
6. Slot kamar yang sudah dipesan penghuni lain ikut dihitung, sehingga kamar
   tidak dapat diisi lebih dari 2 penghuni (dicek di `lib/kamar-options.ts`
   dan seluruh server action pendaftaran/penghuni). Setiap penghuni — termasuk
   yang berbagi kamar — punya akun portal sendiri.

### 3.4 Alur B — "Bayar Sewa Bulanan" online (penghuni aktif)

1. Penghuni yang sudah tidak terkunci membuka `/portal/bayar` (menu **Bayar
   Sewa**).
2. Sistem menghitung tagihan belum Lunas = bulan `tgl_masuk` s.d. **bulan
   berjalan** yang belum punya baris `Lunas` (`lib/bayar-bulanan.ts`).
   Tagihan baru muncul otomatis tiap awal bulan.
3. Penghuni memilih satu/beberapa bulan tagihan + metode online + tanggal
   bayar; total = harga sewa × jumlah bulan.
4. Server mencatat **Lunas** per bulan dalam satu transaksi (baris "Belum Lunas"
   buatan admin ikut diperbarui) lalu mengirim notifikasi penghuni & admin —
   berlaku baik untuk pembayaran Midtrans (otomatis saat `settlement`) maupun
   bukti manual (langsung Lunas saat dikirim).
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
- ✅ **Kapasitas 2 penghuni per kamar**: kolom Penghuni menampilkan jumlah slot
  terpakai (`x/2`) plus penanda **penuh**; kamar penuh otomatis tidak muncul
  lagi di pilihan pendaftaran/penempatan penghuni.
- ✅ Visual badges (dot + label, sesuai aksesibilitas DESIGN.MD).

### 👤 Module 4: Kelola Penghuni (`/penghuni`)
- ✅ CRUD penghuni; pilihan kamar hanya yang benar-benar bisa ditempati
  (`lib/kamar-options.ts`) — kamar **Perbaikan** dan kamar **penuh (2
  penghuni)** diblokir, sedangkan kamar "Terisi" 1 orang tetap bisa dipilih
  untuk penghuni kedua.
- ✅ Pencarian nama/no. kamar; aksi "keluar" mengosongkan kamar otomatis
  (membebaskan satu slot).
- ✅ **Arsip otomatis saat keluar**: tombol proses keluar memindahkan data
  penghuni ke tabel `arsip_penghuni` (menu **Arsip**) — termasuk salinan
  riwayat pembayarannya — lalu kamar dikembalikan menjadi `Tersedia` bila
  tidak ada penghuni aktif lain (`lib/arsip.ts`). Halaman ini juga menjalankan
  pemindaian otomatis: penghuni yang **tagihan sewanya sudah lewat jatuh tempo
  dan belum dilunasi** (acuan: jatuh tempo tanggal 5 tiap bulan, lihat
  `lib/tagihan.ts`) serta data lama ber-status `Keluar` yang belum terarsip
  langsung dipindahkan ke arsip, dengan banner pemberitahuan jumlah data yang
  baru diarsipkan.
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
- ✅ Pembayaran manual (bukti transfer/QRIS) **langsung dicatat Lunas**: begitu
  dikirim dari portal, status berubah otomatis "Belum Lunas" → "Lunas", notifikasi
  terkirim ke penghuni & admin, dan bukti tetap tersimpan sebagai lampiran audit
  (dapat dibuka dari tabel Pembayaran lewat tautan **Bukti**).
- ✅ Verifikasi pembayaran (fitur 1B) tetap tersedia untuk **pengajuan lama**
  ber-status "Menunggu Konfirmasi": kartu verifikasi per pengajuan — Terima →
  Lunas (kunci bayar-awal dibuka), Tolak → kembali menjadi tagihan — plus
  notifikasi ke penghuni.
- ✅ Notifikasi otomatis saat admin mencatat/melunasi pembayaran (status bergerak
  ke Lunas) maupun saat penghuni membayar dari portal.
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
- ✅ **Keluar kos tanpa menu khusus**: kartu *Keluar dari Kos* di beranda portal
  **dihapus** — penghuni cukup keluar (*logout*) dari portal, pengarsipan data +
  pengosongan kamar ditangani otomatis di balik layar (lihat poin berikutnya).
- ✅ **Info jadwal pembayaran di menu *Bayar Sewa***: tanggal pembayaran bulanan
  penghuni (dari pembayaran Lunas terakhir) beserta jatuh tempo tagihan
  berikutnya ditampilkan sebagai **keterangan biasa** di `/portal/bayar` — bukan
  pemberitahuan/peringatan — dan pembayaran tetap bisa dilakukan lebih awal.
- ✅ **Logout = arsip otomatis**: saat penghuni keluar (*logout*) dari portal,
  datanya **tidak dihapus permanen** — identitas, kamar yang ditinggalkan, dan
  salinan riwayat pembayarannya langsung dipindahkan ke tabel `arsip_penghuni`
  (menu **Arsip** pada panel pengelola) dan kamar dikembalikan menjadi
  `Tersedia`. Tidak ada pemberitahuan/peringatan kepada penghuni, dan penghuni
  tidak pernah dikeluarkan hanya karena belum membayar.
- ✅ **Tanpa pemberitahuan di navbar portal**: lonceng/badge notifikasi dihapus
  dari navbar portal penghuni (penghuni tidak perlu tahu soal jatuh tempo/
  pengarsipan). Daftar notifikasi akun tetap dapat dibuka dari kartu **Menu
  Penghuni** di beranda portal; keterangan jadwal bayar ada di menu *Bayar Sewa*.
- ✅ **Layar "Akun Portal Sudah Tidak Aktif"**: akun mantan penghuni yang masuk
  lagi tidak memakai portal; yang tampil hanya keterangan singkat bahwa akunnya
  sudah tidak aktif + ajakan menghubungi pengelola — **tanpa** informasi arsip
  apa pun — beserta tombol keluar.
- ⏳ Pengumuman/kontak admin, profil & ubah password (Roadmap-2D/2E).

### 🔔 Module 8: Notifikasi
- ✅ Tabel `notifikasi` + lonceng pada **panel admin** (badge belum dibaca).
  Lonceng portal penghuni **dihapus dari navbar**; daftar notifikasi akun
  penghuni dibuka dari kartu *Menu Penghuni* di beranda portal.
- ✅ Otomatis: penghuni baru mendaftar, pembayaran awal/bulanan berhasil
  (notifikasi penghuni + seluruh admin via `kirimNotifikasiKeRole`), serta
  **penghuni diarsipkan** (notifikasi **hanya ke seluruh admin** — alasan keluar
  + kamar yang dikosongkan; penghuni **tidak** diberi tahu).
- ⏳ Pengingat tagihan menjelang jatuh tempo (Roadmap-2C) — **sengaja tidak
  diaktifkan**: penghuni tidak perlu tahu; keterangan jadwal bayar cukup tampil
  sebagai info di menu *Bayar Sewa*.

### 📈 Module 9: Laporan Keuangan (`/laporan`)
- ✅ Kartu ringkasan periode: **Pendapatan (Lunas)**, **Piutang (Belum Lunas)**
  + nilai lewat jatuh tempo, **Menunggu Konfirmasi**, dan **rata-rata
  pendapatan per bulan** (jumlah penghuni aktif sebagai konteks).
- ✅ Filter **tahun + rentang bulan** (`dari` s.d. `sampai`) sehingga bisa
  dipakai untuk laporan bulanan, kuartalan, maupun setahun penuh — **berlaku
  otomatis** begitu pilihan diubah (komponen `components/filter-form.tsx`);
  tombol *Terapkan Filter* mengirim ulang nilai aktif dan *Reset* kembali ke
  periode default (tahun berjalan, Januari – Desember).
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

### 📣 Module 10: Pengaduan & Laporan Kendala
- ✅ Penghuni mengirim laporan kendala kamar di `/portal/pengaduan` (menu
  **Pengaduan** pada navbar portal) — `deskripsi_kendala` (10–2000 karakter)
  + `tanggal_lapor` otomatis, status awal **`pending`**; seluruh admin menerima
  notifikasi.
- ✅ Penghuni melihat daftar laporannya sendiri lengkap dengan status terkini
  dan **catatan penanganan** pengelola (badge `pending`/`diproses`/`selesai`).
- ✅ Panel admin `/pengaduan`: kartu ringkasan per status, filter status
  (Semua/Pending/Diproses/Selesai), daftar laporan lengkap dengan pelapor &
  kamar, plus form **Perbarui Status** (`diproses`/`selesai`) yang **wajib
  disertai catatan hasil verifikasi lapangan**; penghuni pelapor otomatis dapat
  notifikasi setiap perubahan status.
- ✅ Waktu penanganan (`ditangani_pada`) dicatat sehingga kecepatan tindak
  lanjut admin dapat diaudit.
- ⏳ Belum ada: lampiran foto kendala, kategori kendala, dan pengingat otomatis
  untuk laporan yang `pending` terlalu lama.

### 🧭 Module 11: Pemantauan Pemilik Kos (`/monitoring`, read-only)
- ✅ Peran baru `pemilik` pada enum `user_role` (migrasi `0006`) dengan beranda
  `/monitoring`; akun dibuat lewat `npm run db:seed` (`SEED_PEMILIK_*`) atau
  insert manual di tabel `users`.
- ✅ `/monitoring` — ringkasan: total kamar & kamar terisi (rasio okupansi),
  penghuni aktif vs terdaftar, pendapatan bulan berjalan, piutang tagihan,
  pengajuan menunggu konfirmasi, akumulasi pendapatan tahun berjalan, kartu
  pengaduan (pending/diproses/selesai), daftar pengaduan & pembayaran terbaru.
- ✅ `/monitoring/kamar`, `/monitoring/penghuni` (dengan pencarian),
  `/monitoring/pembayaran` (filter bulan/tahun/status + export PDF),
  `/monitoring/laporan` (rekap keuangan + filter + export PDF), dan
  `/monitoring/pengaduan` (tabel pengaduan + status + catatan penanganan).
- ✅ `/monitoring/profil` — satu-satunya halaman **menulis** di area pemantauan,
  dan hanya untuk **akun pemilik sendiri** (nama, email, password; ganti
  password wajib verifikasi password lama). Data kos tetap read-only.
- ✅ **Read-only berlapis**: (1) proxy/`authorized` hanya mengizinkan role
  `pemilik` ke `/monitoring*`; (2) layout `/monitoring` menolak role lain;
  (3) halaman pemantauan tidak pernah memanggil aksi mutasi (tidak menerbitkan
  tagihan otomatis); (4) server action mutasi panel (`simpanKamar`,
  `hapusKamar`, `simpanPenghuni`, `hapusPenghuni`, `simpanPembayaran`,
  `hapusPembayaran`, `simpanStatusPengaduan`) menolak role selain `admin`.
- ⏳ Belum ada: notifikasi khusus pemilik, laporan pengaduan PDF, dan grafik
  tren okupansi historis.

### 👥 Module 12: Kelola Akun Staf (`/akun`, khusus pengelola)
- ✅ Daftar akun staf (`admin` & `pemilik`) lengkap dengan **email/username
  login**, peran, dan tanggal dibuat — jadi kredensial pemilik dapat dilihat &
  diatur dari aplikasi, bukan hanya dari `.env`/CLI.
- ✅ **Tambah akun** (nama, email, peran admin/pemilik, password + konfirmasi):
  email wajib unik & valid, password minimal 8 karakter (hash bcrypt) dan
  langsung bisa dipakai login. Akun `pemilik` otomatis diarahkan ke
  `/monitoring`.
- ✅ **Ubah nama & email** akun staf serta **reset password** tanpa password lama
  (khusus pengelola). Untuk akun sendiri, sistem mengarahkan ke `/profil` agar
  verifikasi password lama tetap dijalankan dan sesi JWT ikut disegarkan.
- ✅ Proteksi: hanya role `admin` yang boleh membuka `/akun` (proxy + layout +
  guard di server action); akun `penghuni` tidak dikelola di sini karena
  terikat data penghuni (`users.id_penghuni`).
- ⏳ Belum ada: menonaktifkan/menghapus akun staf, halaman log aktivitas akun,
  dan kirim kredensial lewat email/WhatsApp.

### 🗄️ Module 13: Arsip Otomatis & Pengosongan Kamar (`/arsip`)
- ✅ **Dua pemicu pengarsipan** — semuanya memakai satu helper
  (`arsipkanPenghuni()` di `lib/arsip.ts`) agar perilakunya konsisten:
  1. **Proses keluar oleh pengelola** — tombol proses keluar di `/penghuni`;
  2. **Keluar (*logout*) dari portal** — begitu penghuni menekan tombol *Keluar*
     pada navbar portal, datanya langsung dipindahkan ke arsip (tanpa syarat
     pembayaran apa pun) dan kamar dikosongkan; **tanpa pemberitahuan/peringatan
     apa pun** kepada penghuni (kartu *Keluar dari Kos* terpisah tidak ada lagi).
  Pelengkap: `sinkronkanArsipPenghuni()` (idempotent) dijalankan saat halaman
  `/penghuni` dibuka dan oleh endpoint `/api/cron/generate-tagihan` untuk
  **melengkapi arsip data lama** ber-status `Keluar` yang belum punya baris
  arsip. Tidak ada lagi pengarsipan otomatis karena tagihan belum dibayar.
  Acuan jadwal pembayaran (keterangan di menu *Bayar Sewa*, bukan peringatan) =
  `hariPembayaranPenghuni()` (tanggal pembayaran Lunas terakhir) →
  `tanggalJatuhTempoPeriode()` (mis. selalu tanggal 23; bulan pendek disesuaikan
  ke hari terakhir), dengan `jatuhTempoTiba()` sebagai pembanding tanggal.
- ✅ **Pengosongan kamar otomatis**: `penghuni.id_kamar` dilepas, status
  penghuni menjadi `Keluar`, dan kamar kembali `Tersedia` bila tidak ada
  penghuni aktif lain di kamar tersebut (kapasitas 2 orang tetap dihormati).
- ✅ **Tanpa penghapusan permanen**: baris `penghuni` & `pembayaran` tetap ada
  (laporan keuangan historis aman); snapshot lengkap disimpan di
  `arsip_penghuni` berisi identitas, kamar, masa sewa, ringkasan keuangan, dan
  salinan riwayat pembayaran.
- ✅ **Menu Arsip pada navbar admin**: kartu ringkasan (total arsip, keluar
  tahun ini, proses keluar, habis masa sewa, total tunggakan), filter alasan
  (`Semua` / `Proses Keluar` / `Habis Masa Sewa`), pencarian nama/no. kamar/no.
  HP, serta kartu per mantan penghuni (identitas lengkap, kamar yang
  ditinggalkan, masa sewa, pembayaran/tunggakan, catatan arsip, riwayat
  pembayaran detail) — dipakai sebagai pusat informasi bila Kepolisian/Satpol PP
  memerlukan data riwayat penghuni.
- ⏳ Belum ada: export PDF/print arsip, tombol reaktivasi (kembalikan ke
  penghuni aktif), dan lampiran berkas identitas (KTP).

### 🗄️ Struktur kode penting
```
src/
├─ auth.ts, proxy.ts          # Auth.js + proteksi route per peran (Next.js 16)
├─ db/schema.ts               # Skema Drizzle
├─ lib/
│  ├─ bayar-awal.ts           # Aturan Bayar di Awal + paket 1/2/6 bulan
│  ├─ akun.ts                 # Kelola akun staf: daftar, buat, ubah, reset password
│  ├─ bayar-bulanan.ts        # Tagihan & pembayaran bulanan portal
│  ├─ tagihan.ts              # Auto-generate tagihan + jatuh tempo (1A)
│  ├─ keuangan.ts             # Rekap laporan keuangan (per bulan/metode/tunggakan)
│  ├─ kamar-options.ts        # Kamar yang benar-benar bisa ditempati
│  ├─ monitoring.ts           # Ringkasan read-only pemantauan pemilik (Module 11)
│  ├─ pengaduan.ts            # Modul pengaduan: kirim/daftar/ubah status (Module 10)
│  ├─ pengaduan-status.ts     # Konstanta/label status pengaduan (aman untuk client)
│  ├─ profil.ts               # Ubah identitas & password akun sendiri (server)
│  ├─ profil-actions.ts       # Server action profil (admin & pemilik) + refresh sesi
│  ├─ profil-aturan.ts        # Batas panjang nama/password (aman untuk client)
│  ├─ role.ts                 # Peta peran → beranda & area aplikasi
│  ├─ notifikasi.ts, portal.ts
│  └─ ui.ts, format.ts, laporan.tsx
└─ app/
   ├─ (panel)/…               # Admin (dashboard, kamar, penghuni, pembayaran,
   │                          #   pengaduan, laporan, notifikasi, profil)
   ├─ (pemilik)/monitoring/…  # Pemantauan read-only Pemilik Kos (+ /monitoring/profil)
   ├─ daftar/                 # Registrasi mandiri penghuni baru (publik)
   ├─ daftar-penghuni/        # Aktivasi akun portal penghuni terdata (publik)
   ├─ portal/…                # Portal penghuni (bayar, riwayat, pengaduan, notifikasi)
   └─ api/laporan/…           # Route PDF (pembayaran, status-kamar, keuangan)
```

---

## 5. Keterbatasan Saat Ini (diketahui)

1. **Status Lunas otomatis tanpa verifikasi bukti manual** — Midtrans sudah
   terhubung penuh (settlement → Lunas otomatis) dan bukti manual pun langsung
   dicatat Lunas saat dikirim. Konsekuensinya pengelola **tidak lagi memeriksa
   bukti sebelum** status berubah; auditor hanya dapat memeriksa lampiran
   bukti setelahnya (tautan **Bukti** di tabel Pembayaran). Bila suatu saat
   ingin kembali ke alur verifikasi, kartu verifikasi "Menunggu Konfirmasi"
   masih tersedia.
2. **Penjadwalan otomatis platform belum dipasang** — tagihan dibuat saat
   halaman admin/dashboard dibuka dan bisa dipicu via
   `/api/cron/generate-tagihan`, tetapi cron platform (mis. Vercel, tiap
   tanggal 1) belum dikonfigurasi. Hari jatuh tempo juga masih seragam
   (tanggal 5 tiap bulan), belum bisa diatur per kamar.
3. **Ubah password & profil** sudah tersedia untuk **admin** (`/profil`) dan
   **pemilik** (`/monitoring/profil`) — termasuk ganti nama & email. Yang belum:
   halaman profil serupa di **portal penghuni**, dan fitur **lupa password**
   (reset mandiri via email) untuk semua peran.
4. **Belum ada pagination** di daftar penghuni/pembayaran/riwayat (termasuk
   daftar arsip penghuni).
5. **Belum ada pengingat eksternal** (email/WhatsApp) — notifikasi hanya
   internal aplikasi.
6. **Belum ada audit trail** siapa yang mencatat/mengubah pembayaran — khusus
   modul pengaduan, jejak penanganan sudah terekam lewat `catatan_admin` dan
   `ditangani_pada`.
7. **Pemilik Kos belum menerima notifikasi** (lonceng) — pemantauan dilakukan
   dengan membuka halaman `/monitoring`; notifikasi otomatis masih dikirim ke
   admin & penghuni.

---

## 6. Roadmap

Urutan rekomendasi — dari nilai tertinggi & risiko paling kecil.

### Tahap 1 — Melengkapi Modul Pembayaran
- **1A. Auto-generate tagihan bulanan & jatuh tempo** ✅ *selesai* (migrasi
  `0003`, helper `lib/tagihan.ts`, indikator lewat jatuh tempo di dashboard,
  dan endpoint `/api/cron/generate-tagihan`). Lanjutan opsional: hari jatuh
  tempo per kamar & pasang cron platform.
- **1B. Status pembayaran berjenjang + bukti** ✅ *selesai & disederhanakan* —
  nilai enum `Menunggu Konfirmasi`, kolom `bukti_pembayaran` &
  `kelompok_konfirmasi`, upload bukti di kedua alur portal, kartu verifikasi
  admin (Terima/Tolak), batalkan pengajuan, dan notifikasi hasil.
  **Revisi:** pembayaran manual kini **langsung Lunas** (tanpa antrean
  verifikasi) agar status berubah otomatis + notifikasi; kartu verifikasi
  hanya melayani pengajuan lama. Midtrans tetap otomatis lewat `settlement`.
- **1C. Arsip otomatis & pengosongan kamar** ✅ *selesai* (migrasi `0007`,
  helper `lib/arsip.ts`, menu `/arsip` pada navbar admin, pemicu proses keluar
  oleh pengelola / keluar mandiri dari portal / **logout portal otomatis**,
  pelengkap arsip data lama di `/penghuni` & endpoint cron, plus notifikasi ke
  admin dan penghuni). Keterangan jadwal pembayaran hanya ditampilkan sebagai
  info di menu *Bayar Sewa* (tanpa pemberitahuan/peringatan), dan tidak ada
  pengeluaran penghuni karena tagihan belum dibayar. Lanjutan opsional: export
  PDF arsip, reaktivasi, dan lampiran KTP.

### Tahap 2 — Komunikasi & Kemudahan Penghuni
- **2C. Pengingat tagihan** (notifikasi internal; siap integrasi email/WA).
- **2D. Ubah password & kelola profil** ✅ *sebagian* — halaman `/profil`
  (admin/pengelola) & `/monitoring/profil` (Pemilik Kos), dapat juga dibuka
  dengan mengklik nama pada header. Mendukung ubah **nama**, **email** (validasi
  format + tetap unik antar akun, disimpan huruf kecil), dan **password**
  (password lama diverifikasi bcrypt, minimal 8 karakter, konfirmasi wajib,
  tidak boleh sama dengan password lama). Sesi JWT disegarkan lewat
  `unstable_update` pada callback `jwt` (`trigger: "update"`) sehingga header
  langsung menampilkan identitas baru tanpa login ulang; sesi tetap aktif
  setelah password diganti. Sisa: halaman serupa di portal penghuni & alur
  lupa password.
- **2E. Pengumuman/kontak**: admin menulis info; penghuni melihatnya di
  portal.
- **2F. Pengaduan & laporan kendala kamar** ✅ *selesai* — tabel `pengaduan` +
  enum `status_pengaduan` (migrasi `0006`), form & pantau status di
  `/portal/pengaduan`, penanganan oleh admin di `/pengaduan` (catatan
  verifikasi lapangan wajib diisi), notifikasi otomatis ke penghuni, dan
  pemantauan read-only oleh Pemilik Kos di `/monitoring/pengaduan`. Lanjutan
  opsional: lampiran foto kendala, kategori kendala, dan indikator SLA.
- **2G. Peran Pemilik Kos (read-only)** ✅ *selesai* — nilai `pemilik` pada
  enum `user_role` + area `/monitoring*` (ringkasan, kamar, penghuni,
  pembayaran, laporan keuangan, pengaduan) dengan pengaman berlapis: proteksi
  route per peran (`lib/role.ts` + `auth.ts`), layout `/monitoring` menolak
  role lain, halaman pemantauan tanpa aksi mutasi (tidak menerbitkan tagihan),
  dan server action mutasi panel menolak role selain `admin`. Lanjutan
  opsional: notifikasi/ringkasan berkala (email/WA) untuk pemilik.

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
npm run db:migrate        # terapkan seluruh migrasi (0000–0007)
npm run db:seed           # akun admin (SEED_ADMIN_*); akun pemilik opsional (SEED_PEMILIK_*)
npm run dev               # http://localhost:3000
```

| Script | Fungsi |
| :--- | :--- |
| `npm run dev` / `npm run build` / `npm run start` | Dev / build produksi / start |
| `npm run lint` | ESLint |
| `npm run db:generate` / `db:migrate` / `db:push` / `db:seed` | Migrasi & seed |
| `npm run db:studio` | Drizzle Studio |
