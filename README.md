# Kos Pondok Muslimah — Sistem Manajemen Kos

Aplikasi web manajemen kos berbasis **Next.js (App Router)** dengan **Supabase
(PostgreSQL) + Drizzle ORM**, **Auth.js (NextAuth v5)**, **Tailwind CSS**,
**Midtrans Snap** (payment gateway), dan ekspor laporan **PDF**
(`@react-pdf/renderer`).

> 📘 Spesifikasi lengkap & roadmap: lihat **[PRD.MD](PRD.MD)**.

## Fitur Utama

- **Autentikasi 3 peran** (`users.role`):
  - `admin` → panel manajemen (`/dashboard`, `/kamar`, `/penghuni`, `/arsip`,
    `/pembayaran`, `/pengaduan`, `/laporan`).
  - `pemilik` → **pemantauan read-only** (`/monitoring`) untuk Pemilik Kos:
    ringkasan kamar/penghuni/pendapatan, laporan keuangan, dan tabel pengaduan
    penghuni — tanpa akses menambah/mengubah/menghapus data.
  - `penghuni` → portal mandiri (`/portal`) untuk melihat status kamar,
    riwayat pembayaran, dan mengirim pengaduan kendala kamar.
- **Registrasi mandiri penghuni** (`/daftar`): penghuni baru membuat akun
  sendiri (email & password), memilih kamar, lalu auto-login diarahkan ke
  Pembayaran Awal. Admin juga tetap bisa membuatkan akun penghuni.
- **Aktivasi akun portal penghuni** (`/daftar-penghuni`): penghuni yang sudah
  terdata oleh pengelola (data diri & kamar dicatat admin) tetapi belum punya
  akun dapat membuat email (username) + password sendiri — cukup verifikasi
  lewat Nomor HP/WA yang terdata, lalu langsung masuk ke portal.
- **Pembayaran online otomatis (Midtrans Snap)**: tersedia di **Pembayaran
  Awal** (`/portal/bayar-awal`) **dan** **Bayar Sewa Bulanan** (`/portal/bayar`),
  keduanya dengan opsi **paket 1/2/6 bulan** (boleh bayar di muka) — Transfer
  Bank/Virtual Account/QRIS/E-Wallet. Begitu Midtrans melaporkan `settlement`
  (webhook `/api/payment/midtrans/notification`, tombol "Cek Status Pembayaran",
  atau pemantauan berkala otomatis), bulan-bulan terpilih dicatat **Lunas
  otomatis** tanpa verifikasi pengelola.
- **Bayar Sewa Bulanan online**: penghuni aktif memilih paket 1/2/6 bulan atau
  mencentang bulan tertentu di `/portal/bayar`, lalu membayar **otomatis lewat
  Midtrans** atau **mengirim bukti manual** (diverifikasi pengelola).
- **Status "menunggu pembayaran" & real-time**: saat order online dibuat,
  penghuni langsung menerima notifikasi **"Menunggu Pembayaran Online"**;
  setelah pembayaran masuk, status Lunas, notifikasi, dan status kamar
  diperbarui otomatis (halaman disegarkan tanpa reload manual).
- **Kapasitas kamar otomatis (maks. 2 penghuni/kamar)**: satu kamar boleh
  dihuni sampai **2 orang**, masing-masing dengan akun portal (email &
  password) sendiri. Pilihan kamar pada pendaftaran/admin menampilkan slot
  tersisa; kamar **penuh** atau berstatus **Perbaikan** otomatis diblokir, dan
  halaman `/kamar` menampilkan jumlah slot terpakai (`x/2`).
- **Status Lunas otomatis + notifikasi**: begitu pembayaran diterima — lewat
  Midtrans (`settlement`), bukti manual dari portal, atau dicatat pengelola —
  status baris berubah otomatis dari **Belum Lunas → Lunas**, notifikasi masuk
  ke akun penghuni (dibuka dari kartu *Menu Penghuni* di beranda portal) & ke
  lonceng panel admin, serta kunci bayar-awal/kamar ikut
  diperbarui bila relevan. Bukti bayar tetap tersimpan sebagai lampiran audit
  (tautan **Bukti** di panel Pembayaran).
- **Tagihan otomatis & jatuh tempo**: sistem menerbitkan baris "Belum Lunas"
  untuk penghuni aktif (periode `tgl_masuk` s.d. bulan berjalan) lengkap
  dengan jatuh tempo (tanggal 5 tiap bulan); dashboard menampilkan indikator
  "lewat jatuh tempo", dan tersedia endpoint `/api/cron/generate-tagihan`
  untuk penjadwalan bulanan.
- **Kunci menu otomatis & status kamar**: sebelum pembayaran awal lunas, menu
  portal terkunci hanya ke Pembayaran Awal dan **status kamar tetap
  "Tersedia"** (kamar hanya "dipesan" agar tidak dipesan penghuni lain).
  Begitu pembayaran awal lunas (termasuk lewat Midtrans), kunci terbuka dan
  kamar resmi berstatus **"Terisi"**.
- **Arsip otomatis & pengosongan kamar**: data penghuni **tidak pernah dihapus
  permanen**. Saat penghuni keluar — diproses pengelola lewat tombol proses
  keluar di `/penghuni`, atau **langsung ketika penghuni logout dari portal** —
  identitas, kamar yang ditinggalkan, dan salinan riwayat pembayarannya otomatis
  dipindahkan ke tabel **`arsip_penghuni`** (menu **Arsip** pada navbar admin),
  lalu kamar itu kembali ber-status **Tersedia** bila tidak ada penghuni aktif
  lain. Proses ini **tanpa pemberitahuan apa pun ke penghuni**: tidak ada
  peringatan jatuh tempo, tidak ada info arsip di navbar portal, dan penghuni
  tidak pernah dikeluarkan hanya karena tagihan belum dibayar; keterangan jadwal
  pembayaran (tanggal bayar bulanan dari pembayaran terakhir + jatuh tempo
  tagihan berikutnya) cukup ditampilkan sebagai info di menu **Bayar Sewa**.
  Menu **Arsip** menampilkan seluruh mantan penghuni (identitas, kamar, masa
  sewa, ringkasan pembayaran/tunggakan, riwayat pembayaran) dengan filter alasan
  & pencarian — pusat informasi bila Kepolisian/Satpol PP memerlukan riwayat
  penghuni. Helper: `src/lib/arsip.ts`, migrasi `drizzle/0007_*`.
- **Notifikasi otomatis**: tabel `notifikasi` + lonceng pada panel admin
  (penghuni baru mendaftar, order menunggu pembayaran, pembayaran diterima,
  status tagihan berubah menjadi **Lunas** — baik dari portal maupun saat
  dicatat pengelola). Di portal penghuni lonceng **tidak ditampilkan** pada
  navbar; daftar notifikasi akun tetap dapat dibuka dari kartu **Menu Penghuni**
  di beranda portal (`/portal/notifikasi`).
- **Dashboard**: statistik kamar/penghuni/pembayaran + alert penghuni belum lunas.
- **CRUD Kamar / Penghuni / Pembayaran** + filter & pencarian.
- **Laporan Keuangan** (`/laporan`): rekap pendapatan per bulan (bar proporsi),
  pendapatan per metode bayar, ringkasan piutang & pengajuan menunggu
  konfirmasi, sorotan keuangan (bulan tertinggi, rasio piutang), dan daftar
  tunggakan per penghuni — dengan filter **tahun + rentang bulan** (bulanan,
  kuartalan, atau setahun) yang **langsung berlaku saat pilihan diubah**
  (tombol *Terapkan Filter* & *Reset* tetap tersedia) dan tautan tindak lanjut
  ke halaman Pembayaran. Tersedia juga dari tombol di halaman Pembayaran dan
  tautan pada kartu Pembayaran di dashboard.
- **Filter langsung (auto-apply)**: kontrol filter panel (Tahun/Bulan/Status
  pada halaman Pembayaran dan Tahun/Dari–Sampai Bulan pada Laporan Keuangan)
  memakai komponen `FilterForm` sehingga memilih nilai langsung mengarahkan ke
  hasil filter yang dituju; tampilan kontrol selalu sinkron dengan URL
  (termasuk setelah *Reset*).
- **Ekspor PDF**: laporan status kamar, laporan pembayaran, dan laporan
  keuangan (`/api/laporan/keuangan`, 2 halaman: ringkasan + rekap bulanan lalu
  per metode bayar + tunggakan) — semuanya mengikuti filter aktif.
- **Pengaduan & Laporan Kendala (penghuni → admin → pemilik)**:
  - Penghuni mengirim kendala kamar di **`/portal/pengaduan`** (menu
    *Pengaduan* di navbar portal) — laporan tercatat dengan status awal
    **Pending** dan seluruh pengelola otomatis menerima notifikasi.
  - Pengelola memverifikasi **di lapangan**, menuliskan catatan penanganan, lalu
    mengubah status menjadi **Diproses** atau **Selesai** di **`/pengaduan`**
    (catatan wajib agar dapat diaudit). Penghuni pelapor langsung dapat
    notifikasi setiap status berubah dan melihat catatannya di portal.
  - **Pemilik Kos memantau tabel pengaduan** (`/monitoring/pengaduan`) secara
    read-only untuk mengontrol kinerja pengelola secara transparan dari luar
    kota. Data: tabel `pengaduan` (migrasi `drizzle/0006_*`), helper
    `src/lib/pengaduan.ts`.
- **Pemantauan Pemilik Kos (`/monitoring`, read-only)**: ringkasan total kamar
  & kamar terisi (rasio okupansi), jumlah penghuni aktif/terdaftar, pendapatan
  bulan berjalan + akumulasi tahun, piutang & pengajuan menunggu konfirmasi,
  laporan keuangan (filter tahun/rentang bulan + export PDF), daftar kamar,
  data penghuni, riwayat pembayaran, dan tabel pengaduan — seluruhnya hanya
  membaca data (tidak menerbitkan tagihan, tidak ada tombol tambah/ubah/hapus;
  server action mutasi juga menolak role `pemilik`).
- **Kelola Akun staf (`/akun`, khusus pengelola)**: daftar akun `admin` &
  `pemilik` beserta **email/username** yang dipakai login, form **Tambah Akun**
  (nama, email, peran, password) sehingga akun Pemilik Kos bisa dibuat langsung
  dari web — tanpa perlu mengubah `.env` atau menjalankan CLI, ubah nama &
  email akun staf, dan **reset password** akun staf tanpa password lama. Akun
  sendiri diarahkan ke halaman Profil (wajib password lama berubah).
  Data & validasi: `src/lib/akun.ts`.
- **Ubah password & profil (admin & pemilik)**: halaman **`/profil`** di panel
  pengelola dan **`/monitoring/profil`** di area pemilik (juga bisa dibuka
  dengan mengklik nama di header). Bisa mengubah nama, email (validasi format +
  tetap unik antar akun), dan password (password lama diverifikasi, minimal 8
  karakter, konfirmasi wajib, tidak boleh sama dengan yang lama). Setelah nama &
  email disimpan, sesi JWT langsung disegarkan (`unstable_update`) sehingga
  header memakai identitas baru tanpa login ulang; sesi tetap aktif setelah
  password diganti. Halaman ini satu-satunya yang menulis di area pemantauan,
  dan hanya untuk **akun sendiri** — data kos tetap read-only.

## Alur "Registrasi & Bayar di Awal" (Penghuni Baru)

1. **Registrasi**: penghuni membuka `/daftar`, mengisi data diri, memilih kamar
   tersedia, lalu membuat **email & password sendiri**. Sistem membuat akun
   `role: penghuni` tertaut ke data penghuni (`users.id_penghuni`), menandai
   `penghuni.perlu_bayar_awal = true`, dan mengirim notifikasi ke admin.
2. **Login**: penghuni masuk (email/password) — akun juga dapat dibuatkan admin
   saat mendaftarkan penghuni. Saat pertama kali masuk, sistem otomatis
   **mengunci menu lain** dan mengarahkan ke `/portal/bayar-awal`.
3. **Bayar awal**: penghuni memilih paket **1, 2, atau 6 bulan**
   (total = harga sewa × jumlah bulan), lalu:
   - **Bayar Online Sekarang** (Midtrans Snap) → saat Midtrans melaporkan
     `settlement`, seluruh bulan pada paket dicatat **Lunas otomatis** dan
     kunci portal langsung terbuka; atau
   - **kirim bukti manual** (metode online + upload bukti) → seluruh bulan pada
     paket **langsung dicatat Lunas** begitu form dikirim.
4. **Status otomatis**: kunci portal terbuka (`perlu_bayar_awal = false`),
   kamar menjadi **Terisi**, seluruh menu portal terbuka, dan notifikasi
   otomatis terkirim ke penghuni & admin. Bukti bayar tetap tersimpan sebagai
   lampiran audit (tautan **Bukti** di panel Pembayaran).
5. Kamar yang sudah diisi penghuni lain tetap dapat dipilih **selama slotnya
   belum penuh** — satu kamar maksimal **2 penghuni** (lihat
   `src/lib/kapasitas-kamar.ts`). **Status kamar tetap "Tersedia"** sampai
   pembayaran awal lunas — baru setelah itu kamar berstatus **"Terisi"**
   (lihat `sinkronPembayaranAwal` di `src/lib/bayar-awal.ts`).

Struktur data terkait: kolom `role` & `id_penghuni` di tabel `users`, kolom
`perlu_bayar_awal` di tabel `penghuni`, dan tabel `notifikasi` (migrasi
`drizzle/0001_*` dan `drizzle/0002_*`).

## Alur "Bayar Sewa Bulanan" (Penghuni Aktif)

1. Penghuni yang sudah melewati Pembayaran Awal (menu portal terbuka) membuka
   `/portal/bayar` lewat menu **Bayar Sewa**.
2. Sistem menghitung **tagihan belum Lunas**: seluruh bulan dari periode
   `tgl_masuk` sampai bulan berjalan yang tidak/belum tercatat `pembayaran`
   berstatus Lunas. Tagihan baru otomatis muncul setiap awal bulan.
3. Halaman menyediakan **paket cepat 1/2/6 bulan** (bulan berurutan mulai
   tagihan terawal, termasuk bulan yang belum jatuh tempo — bayar di muka)
   serta centang bulan tertentu:
   - **Bayar Online Sekarang** → server membuat order **Midtrans Snap**
     (`transaksi_online` tipe `bayar_bulanan`, rincian item per bulan) dan
     mengirim notifikasi **"Menunggu Pembayaran Online"**; saat Midtrans
     melaporkan `settlement`, bulan-bulan terpilih langsung **Lunas** tanpa
     verifikasi manual; atau
   - **Kirim bukti manual**: pilih metode Transfer/Virtual Account/QRIS/
     E-Wallet, tanggal, lalu **upload bukti**.
   Total = harga sewa kamar × jumlah bulan dipilih.
4. Bulan-bulan yang dibayar **langsung dicatat Lunas** dan notifikasi otomatis
   terkirim ke penghuni & admin. (Untuk data lama yang masih ber-status
   "Menunggu Konfirmasi", admin tetap bisa memverifikasi **Terima**/**Tolak**
   di panel Pembayaran.)
5. Penghuni baru yang belum menyelesaikan Pembayaran Awal tidak dapat
   mengakses halaman ini (dialihkan ke `/portal/bayar-awal`).
6. Bila ada transaksi Midtrans yang belum selesai, halaman menampilkan panel
   "Pembayaran sedang berjalan" (lanjutkan di halaman pembayaran atau tekan
   **Cek Status Pembayaran**) dan menyembunyikan form bukti manual agar tidak
   terjadi pembayaran ganda. Order berjalan **dipantau berkala di browser**,
   jadi begitu pembayaran masuk (mis. VA/QRIS dibayar dari tab lain) tagihan,
   status kamar, dan notifikasi langsung ter-update tanpa reload manual.

Struktur data terkait: tabel `kamar`, `pembayaran`, dan `transaksi_online`
(migrasi `drizzle/0005_*`), helper `src/lib/bayar-bulanan.ts`,
`src/lib/payment-online.ts`, serta halaman `/portal/bayar`.

## Alur "Aktivasi Akun" (Penghuni Sudah Terdata Pengelola)

Penghuni yang data dirinya sudah dicatat oleh pengelola (misalnya dibuat saat
masuk kos sebelum ada fitur akun) tetapi belum memiliki akun login:

1. Penghuni membuka `/daftar-penghuni` (atau tautan di halaman `/login`).
2. Mengisi **Nomor HP/WA** (harus sesuai yang dicatat pengelola) untuk
   verifikasi data; Nama Lengkap opsional bila ada dua data bernomor sama.
3. Membuat **email** (dipakai sebagai username login) & **password** sendiri
   (minimal 6 karakter).
4. Sistem menautkan akun ke data penghuni (`users.id_penghuni`), mengirim
   notifikasi ke admin, lalu auto-login ke portal (`/portal`). Bila kamar
   masih menunggu Pembayaran Awal, sistem otomatis mengarahkan ke
   `/portal/bayar-awal`.

> Penghuni yang **belum terdata sama sekali** tidak bisa lewat halaman ini —
> gunakan `/daftar` (registrasi penghuni baru + pilih kamar + Pembayaran Awal).

Struktur data terkait: hanya memakai tabel `users` & `penghuni` yang sudah ada
(tidak ada migrasi baru); aksi `aktifkanAkunPortal` di `src/app/daftar-penghuni/actions.ts`.

## Akun Pemilik Kos (Pemantauan Read-only)

1. Isi `SEED_PEMILIK_EMAIL` & `SEED_PEMILIK_PASSWORD` (minimal 8 karakter) pada
   `.env` — opsional `SEED_PEMILIK_NAME` (default "Pemilik Kos Pondok
   Muslimah").
2. Jalankan `npm run db:seed` (sekalian membuat akun admin). Seed bersifat
   idempotent — bila email sudah terdaftar, tidak ada yang diubah.
   Akun juga bisa dibuat manual di tabel `users` dengan `role = 'pemilik'`.
3. Pemilik masuk lewat `/login` dan otomatis diarahkan ke **`/monitoring`**:
   ringkasan kamar/penghuni/pendapatan, laporan keuangan, dan tabel pengaduan
   penghuni. Bila pemilik membuka `/dashboard`, `/kamar`, `/pembayaran`,
   `/pengaduan`, atau `/portal`, sistem mengembalikannya ke `/monitoring`.

> Area `/monitoring*` bersifat **read-only**: tidak ada tombol tambah/ubah/hapus,
> halaman pemantauan tidak menerbitkan tagihan otomatis, dan server action
> mutasi (kamar/penghuni/pembayaran/status pengaduan) menolak role `pemilik`.

## Menjalankan

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, AUTH_SECRET, dll.
npm run db:migrate     # terapkan seluruh migrasi Drizzle (0000–0007)
npm run db:seed        # akun admin (SEED_ADMIN_*); akun pemilik opsional (SEED_PEMILIK_*)
npm run dev
```

Buka http://localhost:3000 → login sebagai admin atau penghuni.

## Script Berguna

| Script | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan dev server |
| `npm run build` | Build produksi |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate migrasi baru dari `src/db/schema.ts` |
| `npm run db:migrate` | Terapkan migrasi ke database |
| `npm run db:push` | Push skema tanpa migrasi (untuk prototyping) |
| `npm run db:seed` | Seed akun admin |

## Struktur Penting

```
src/
├─ auth.ts                    # Auth.js: authorize + proteksi route per peran
├─ db/schema.ts               # Skema Drizzle (users, kamar, penghuni, pembayaran, notifikasi, pengaduan, arsip_penghuni)
├─ lib/
│  ├─ arsip.ts                # Arsip otomatis & pengosongan kamar (snapshot + kamar Tersedia)
│  ├─ bayar-awal.ts           # Logika aturan "Bayar di Awal" + paket 1/2/6 bulan
│  ├─ akun.ts                 # Kelola akun staf (admin/pemilik): daftar, buat, reset
│  ├─ kapasitas-kamar.ts      # Aturan kapasitas kamar (maks. 2 penghuni)
│  ├─ keuangan.ts             # Rekap laporan keuangan (bulan/metode/tunggakan)
│  ├─ kamar-options.ts        # Filter kamar yang benar-benar bisa ditempati
│  ├─ monitoring.ts           # Ringkasan read-only untuk pemantauan pemilik
│  ├─ notifikasi.ts           # Helper notifikasi dalam aplikasi
│  ├─ pengaduan.ts            # Modul pengaduan (kirim, daftar, ubah status)
│  ├─ pengaduan-status.ts     # Konstanta/label status pengaduan (aman di client)
│  ├─ portal.ts               # Konteks sesi portal penghuni
│  ├─ profil.ts               # Ubah identitas & password akun (server)
│  ├─ profil-actions.ts       # Server action profil (admin & pemilik)
│  ├─ profil-aturan.ts        # Batas panjang nama/password (aman di client)
│  └─ role.ts                 # Peta peran → beranda & area aplikasi
└─ app/
   ├─ (panel)/                # Halaman admin (termasuk /arsip, /pengaduan, /notifikasi, /akun, /profil)
   ├─ (pemilik)/monitoring/   # Pemantauan read-only Pemilik Kos (+ /profil)
   ├─ daftar/                 # Registrasi mandiri penghuni baru (publik)
   ├─ daftar-penghuni/        # Aktivasi akun portal penghuni terdata (publik)
   ├─ portal/                 # Portal penghuni (beranda, bayar, riwayat, pengaduan, notifikasi)
   └─ api/laporan/            # Route PDF (pembayaran, status-kamar, keuangan)
```

