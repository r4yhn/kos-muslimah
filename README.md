# Kos Pondok Muslimah — Sistem Manajemen Kos

Aplikasi web manajemen kos berbasis **Next.js (App Router)** dengan **Supabase
(PostgreSQL) + Drizzle ORM**, **Auth.js (NextAuth v5)**, **Tailwind CSS**,
**Midtrans Snap** (payment gateway), dan ekspor laporan **PDF**
(`@react-pdf/renderer`).

> 📘 Spesifikasi lengkap & roadmap: lihat **[PRD.MD](PRD.MD)**.

## Fitur Utama

- **Autentikasi 2 peran** (`users.role`):
  - `admin` → panel manajemen (`/dashboard`, `/kamar`, `/penghuni`,
    `/pembayaran`, `/laporan`).
  - `penghuni` → portal mandiri (`/portal`) untuk melihat status kamar &
    riwayat pembayaran.
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
  diperbarui otomatis (halaman disegarkan tanpa reload manual) — lonceng
  notifikasi portal juga menyegar sendiri setiap ±15 detik.
- **Verifikasi pembayaran oleh pengelola**: panel Pembayaran menampilkan kartu
  verifikasi (lihat bukti, klik Terima → Lunas atau Tolak → kembali tagihan);
  notifikasi otomatis ke penghuni.
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
- **Notifikasi otomatis**: tabel `notifikasi` + lonceng di portal & panel admin
  (penghuni baru mendaftar, order menunggu pembayaran, pembayaran diterima,
  hasil verifikasi terima/tolak).
- **Dashboard**: statistik kamar/penghuni/pembayaran + alert penghuni belum lunas.
- **CRUD Kamar / Penghuni / Pembayaran** + filter & pencarian.
- **Laporan Keuangan** (`/laporan`): rekap pendapatan per bulan (bar proporsi),
  pendapatan per metode bayar, ringkasan piutang & pengajuan menunggu
  konfirmasi, sorotan keuangan (bulan tertinggi, rasio piutang), dan daftar
  tunggakan per penghuni — dengan filter **tahun + rentang bulan** (bulanan,
  kuartalan, atau setahun) dan tautan tindak lanjut ke halaman Pembayaran.
  Tersedia juga dari tombol di halaman Pembayaran.
- **Ekspor PDF**: laporan status kamar, laporan pembayaran, dan laporan
  keuangan (`/api/laporan/keuangan`, 2 halaman: ringkasan + rekap bulanan lalu
  per metode bayar + tunggakan) — semuanya mengikuti filter aktif.

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
   - **kirim bukti manual** (metode online + upload bukti) → setiap bulan pada
     paket dicatat **Menunggu Konfirmasi** dalam satu kelompok pengajuan.
4. **Verifikasi pengelola**: admin menekan **Terima** di panel Pembayaran →
   bulan-bulan menjadi **Lunas**, `perlu_bayar_awal = false`, kamar menjadi
   **Terisi**, seluruh menu portal terbuka, dan notifikasi otomatis dikirim
   ke penghuni & admin. Bila **Tolak**, baris kembali menjadi tagihan dan
   penghuni dapat mengunggah ulang.
5. Kamar yang sedang menunggu pembayaran awal **tidak bisa dipesan** penghuni
   lain (konsisten untuk akun buatan admin maupun registrasi mandiri).
   **Status kamar tetap "Tersedia"** sampai pembayaran awal lunas — baru
   setelah itu kamar berstatus **"Terisi"** (lihat `sinkronPembayaranAwal` di
   `src/lib/bayar-awal.ts`).

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
4. Bulan-bulan yang diajukan manual berstatus **Menunggu Konfirmasi**. Setelah
   admin memverifikasi (**Terima**) di panel Pembayaran, baris menjadi
   **Lunas**; bila **Tolak**, kembali menjadi tagihan dan penghuni bisa
   mengajukan ulang.
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

## Menjalankan

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, AUTH_SECRET, dll.
npm run db:migrate     # terapkan migrasi Drizzle
npm run db:seed        # buat akun admin (SEED_ADMIN_*)
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
├─ db/schema.ts               # Skema Drizzle (users, kamar, penghuni, pembayaran, notifikasi)
├─ lib/
│  ├─ bayar-awal.ts           # Logika aturan "Bayar di Awal" + paket 1/2/6 bulan
│  ├─ keuangan.ts             # Rekap laporan keuangan (bulan/metode/tunggakan)
│  ├─ kamar-options.ts        # Filter kamar yang benar-benar bisa ditempati
│  ├─ notifikasi.ts           # Helper notifikasi dalam aplikasi
│  └─ portal.ts               # Konteks sesi portal penghuni
└─ app/
   ├─ (panel)/                # Halaman admin (termasuk /laporan & /notifikasi)
   ├─ daftar/                 # Registrasi mandiri penghuni baru (publik)
   ├─ daftar-penghuni/        # Aktivasi akun portal penghuni terdata (publik)
   ├─ portal/                 # Portal penghuni (beranda, bayar-awal, riwayat, notifikasi)
   └─ api/laporan/            # Route PDF (pembayaran, status-kamar, keuangan)
```

