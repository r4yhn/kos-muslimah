import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ================================================================
 * ENUM
 * ================================================================ */

/**
 * Peran akun:
 * - `admin`    -> pengelola yang mengelola seluruh data (panel).
 * - `pemilik`  -> Pemilik Kos: pemantauan **read-only** (`/monitoring`).
 * - `penghuni` -> portal mandiri penghuni (`/portal`).
 */
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "pemilik",
  "penghuni",
]);

/** Status kamar: Tersedia / Terisi / Perbaikan */
export const statusKamarEnum = pgEnum("status_kamar", [
  "Tersedia",
  "Terisi",
  "Perbaikan",
]);

/** Status penghuni: Aktif / Keluar */
export const statusPenghuniEnum = pgEnum("status_penghuni", [
  "Aktif",
  "Keluar",
]);

/** Status pembayaran: Lunas / Menunggu Konfirmasi (bukti perlu dicek admin) / Belum Lunas (tagihan) */
export const statusBayarEnum = pgEnum("status_bayar", [
  "Lunas",
  "Menunggu Konfirmasi",
  "Belum Lunas",
]);

/**
 * Status penanganan pengaduan penghuni:
 * - `pending`  -> baru dilaporkan penghuni, belum ditangani admin;
 * - `diproses` -> admin sudah memverifikasi di lapangan & sedang menangani;
 * - `selesai`  -> kendala sudah dituntaskan (dibuktikan lewat catatan admin).
 */
export const statusPengaduanEnum = pgEnum("status_pengaduan", [
  "pending",
  "diproses",
  "selesai",
]);

/**
 * Alasan sebuah data penghuni dipindahkan ke `arsip_penghuni`
 * (fitur "Arsip Otomatis & Pengosongan Kamar"):
 * - `Proses Keluar`   -> penghuni mengakhiri masa sewa (diproses pengelola atau
 *   lewat tombol *Selesai Sewa / Pindah Kos* di portal — bukan tombol *Keluar*),
 *   termasuk keluar sebelum jatuh tempo;
 * - `Habis Masa Sewa` -> periode sewa terakhir yang sudah Lunas telah berakhir
 *   (dideteksi otomatis oleh sistem pada pemindaian data lama).
 */
export const alasanArsipEnum = pgEnum("alasan_arsip", [
  "Proses Keluar",
  "Habis Masa Sewa",
]);

/* ================================================================
 * users — Admin / Pengelola (Auth.js Credentials)
 * ================================================================ */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  /** Hash password (bcrypt) */
  password: text("password").notNull(),
  /**
   * Peran akun. Penghuni yang punya akun bisa login ke portal mandiri
   * (/portal) untuk menyelesaikan "Pembayaran Awal".
   */
  role: userRoleEnum("role").notNull().default("admin"),
  /**
   * Menautkan akun ke data penghuni (khusus role "penghuni").
   * Unique + ON DELETE CASCADE: saat data penghuni dihapus, akunnya ikut
   * terhapus sehingga tidak ada akun yatim.
   */
  idPenghuni: uuid("id_penghuni")
    .unique()
    .references(() => penghuni.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ================================================================
 * kamar — Master data kamar
 * ================================================================ */

export const kamar = pgTable("kamar", {
  id: uuid("id").primaryKey().defaultRandom(),
  noKamar: varchar("no_kamar", { length: 50 }).notNull().unique(),
  tipeKamar: varchar("tipe_kamar", { length: 100 }).notNull(),
  hargaSewa: integer("harga_sewa").notNull(),
  statusKamar: statusKamarEnum("status_kamar").notNull().default("Tersedia"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ================================================================
 * penghuni — Data penghuni / penyewa kamar
 * ================================================================ */

export const penghuni = pgTable("penghuni", {
  id: uuid("id").primaryKey().defaultRandom(),
  idKamar: uuid("id_kamar").references(() => kamar.id, {
    onDelete: "set null",
  }),
  nama: varchar("nama", { length: 255 }).notNull(),
  jenisKelamin: varchar("jenis_kelamin", { length: 20 }).notNull(),
  alamat: text("alamat").notNull(),
  noHp: varchar("no_hp", { length: 20 }).notNull(),
  tglMasuk: date("tgl_masuk", { mode: "date" }).notNull(),
  status: statusPenghuniEnum("status").notNull().default("Aktif"),
  /**
   * Aturan "Bayar di Awal": true untuk penghuni baru yang punya akun login
   * sebelum melunasi pembayaran awal (sewa bulan pertama). Selama true,
   * portal penghuni terkunci hanya ke halaman /portal/bayar-awal dan kamar
   * belum dianggap resmi "Terisi".
   */
  perluBayarAwal: boolean("perlu_bayar_awal").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ================================================================
 * pembayaran — Transaksi pembayaran sewa bulanan
 * ================================================================ */

export const pembayaran = pgTable(
  "pembayaran",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idPenghuni: uuid("id_penghuni")
      .notNull()
      .references(() => penghuni.id, { onDelete: "cascade" }),
    tanggalBayar: date("tanggal_bayar", { mode: "date" }),
    /**
     * Jatuh tempo tagihan. Diisi otomatis saat sistem menerbitkan tagihan
     * "Belum Lunas" (lihat `lib/tagihan.ts`); boleh kosong untuk catatan
     * pembayaran/tagihan manual lama.
     */
    jatuhTempo: date("jatuh_tempo", { mode: "date" }),
    /**
     * Bukti pembayaran online sebagai data URL gambar (base64). Diisi saat
     * penghuni mengirim pembayaran "Menunggu Konfirmasi", lalu diverifikasi
     * admin sebelum diubah menjadi Lunas.
     */
    buktiPembayaran: text("bukti_pembayaran"),
    /**
     * Penanda satu pengajuan pembayaran online yang mencakup beberapa bulan.
     * Beberapa baris `pembayaran` dengan `kelompok_konfirmasi` sama diverifikasi
     * admin sekaligus (terima/tolak).
     */
    kelompokKonfirmasi: uuid("kelompok_konfirmasi"),
    /** Bulan 1–12 */
    bulan: integer("bulan").notNull(),
    tahun: integer("tahun").notNull(),
    jumlahBayar: integer("jumlah_bayar").notNull(),
    metodeBayar: varchar("metode_bayar", { length: 50 }).notNull(),
    keterangan: text("keterangan"),
    statusBayar: statusBayarEnum("status_bayar").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pembayaran_bulan_tahun_idx").on(table.bulan, table.tahun),
    check(
      "pembayaran_bulan_check",
      sql`${table.bulan} BETWEEN 1 AND 12`
    ),
  ]
);

/* ================================================================
 * notifikasi — Notifikasi dalam aplikasi (portal penghuni & admin)
 * ================================================================ */

export const notifikasi = pgTable(
  "notifikasi",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Akun penerima notifikasi (users.id). */
    idUser: uuid("id_user")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    judul: varchar("judul", { length: 255 }).notNull(),
    pesan: text("pesan").notNull(),
    dibaca: boolean("dibaca").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("notifikasi_id_user_idx").on(table.idUser)]
);

/* ================================================================
 * pengaduan — Pengaduan / laporan kendala kamar dari penghuni
 * ================================================================ */

/**
 * Alur modul "Pengaduan & Laporan Kendala":
 * 1. Penghuni mengirim deskripsi kendala dari portal (`/portal/pengaduan`)
 *    -> baris dibuat dengan `status_penyelesaian = 'pending'`.
 * 2. Admin memverifikasi di lapangan lalu memperbarui status dari panel
 *    (`/pengaduan`) menjadi `diproses` / `selesai` + catatan penanganan.
 * 3. Pemilik Kos memantau tabel ini dari area read-only (`/monitoring/pengaduan`)
 *    untuk mengontrol kinerja admin secara transparan.
 */
export const pengaduan = pgTable(
  "pengaduan",
  {
    /** id_pengaduan (PK). */
    idPengaduan: uuid("id_pengaduan").primaryKey().defaultRandom(),
    /** Penghuni pelapor; bila data penghuni dihapus, pengaduannya ikut terhapus. */
    idPenghuni: uuid("id_penghuni")
      .notNull()
      .references(() => penghuni.id, { onDelete: "cascade" }),
    /** Uraian kendala kamar yang dilaporkan penghuni. */
    deskripsiKendala: text("deskripsi_kendala").notNull(),
    /** Tanggal laporan dibuat (tanggal murni, UTC). */
    tanggalLapor: date("tanggal_lapor", { mode: "date" })
      .notNull()
      .defaultNow(),
    /** Status penanganan oleh admin. */
    statusPenyelesaian: statusPengaduanEnum("status_penyelesaian")
      .notNull()
      .default("pending"),
    /**
     * Catatan penanganan admin (mis. hasil verifikasi lapangan / tindakan yang
     * dilakukan). Ditampilkan ke penghuni & Pemilik Kos agar transparan.
     */
    catatanAdmin: text("catatan_admin"),
    /** Kapan status terakhir diperbarui admin. */
    ditanganiPada: timestamp("ditangani_pada", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pengaduan_id_penghuni_idx").on(table.idPenghuni),
    index("pengaduan_status_idx").on(table.statusPenyelesaian),
  ]
);

/* ================================================================
 * transaksi_online — Order pembayaran online lewat payment gateway
 * (Midtrans Snap). Baris `pembayaran` per bulan baru dicatat Lunas
 * saat Midtrans melaporkan status `settlement` (webhook / cek status).
 * ================================================================ */

export type DetailTransaksiOnline = {
  /** Jumlah bulan untuk tipe "bayar_awal" (paket 1/2/6). */
  paket?: number;
  /** Periode (bulan & tahun) yang dicakup transaksi. */
  periode: { bulan: number; tahun: number }[];
  /** Label ringkas untuk keterangan, mis. "Pembayaran Awal paket 3 bulan". */
  label: string;
};

export const transaksiOnline = pgTable(
  "transaksi_online",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Order ID unik yang dikirim ke Midtrans (maks 50 karakter). */
    orderId: varchar("order_id", { length: 64 }).notNull().unique(),
    idPenghuni: uuid("id_penghuni")
      .notNull()
      .references(() => penghuni.id, { onDelete: "cascade" }),
    /** Jenis transaksi: "bayar_awal" | "bayar_bulanan". */
    tipe: varchar("tipe", { length: 20 }).notNull(),
    /** Total nominal (rupiah) yang dibayar penghuni. */
    nominal: integer("nominal").notNull(),
    /**
     * Status dari Midtrans: pending / settlement / challenge / expire /
     * cancel / deny. Hanya "settlement" yang mengubah pembayaran jadi Lunas.
     */
    statusMidtrans: varchar("status_midtrans", { length: 20 })
      .notNull()
      .default("pending"),
    snapToken: text("snap_token"),
    redirectUrl: text("redirect_url"),
    /** Kanal pembayaran setelah settlement (mis. "qris", "bank_transfer"). */
    metodeBayar: varchar("metode_bayar", { length: 50 }),
    detail: jsonb("detail")
      .$type<DetailTransaksiOnline>()
      .notNull()
      .default({ periode: [], label: "" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("transaksi_online_id_penghuni_idx").on(table.idPenghuni),
    index("transaksi_online_status_idx").on(table.statusMidtrans),
  ]
);

/* ================================================================
 * arsip_penghuni — Arsip mantan penghuni (fitur "Arsip Otomatis &
 * Pengosongan Kamar")
 *
 * Setiap penghuni yang keluar (diproses pengelola, diajukan sendiri dari
 * portal, atau masa sewanya habis) **disalin sebagai snapshot** ke tabel ini
 * sebelum kamarnya dikosongkan kembali menjadi "Tersedia". Tabel ini adalah
 * pusat informasi riwayat penghuni (mis. permintaan data oleh Kepolisian /
 * Satpol PP) dan sengaja menyimpan salinan identitas + ringkasan riwayat
 * pembayaran supaya data tidak hilang meski catatan operasional berubah.
 * ================================================================ */

/** Satu baris riwayat pembayaran yang dibekukan ke dalam arsip. */
export type RiwayatPembayaranArsip = {
  bulan: number;
  tahun: number;
  jumlahBayar: number;
  statusBayar: "Lunas" | "Menunggu Konfirmasi" | "Belum Lunas";
  metodeBayar: string;
  keterangan: string | null;
  /** Tanggal ISO (YYYY-MM-DD) atau null untuk tagihan yang belum dibayar. */
  tanggalBayar: string | null;
  jatuhTempo: string | null;
};

export const arsipPenghuni = pgTable(
  "arsip_penghuni",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Tautan ke baris `penghuni` asal (snapshot tetap utuh walau data
     * penghuninya dihapus manual kemudian -> SET NULL).
     */
    idPenghuni: uuid("id_penghuni").references(() => penghuni.id, {
      onDelete: "set null",
    }),
    /** Snapshot identitas penghuni saat keluar. */
    nama: varchar("nama", { length: 255 }).notNull(),
    jenisKelamin: varchar("jenis_kelamin", { length: 20 }).notNull(),
    alamat: text("alamat").notNull(),
    noHp: varchar("no_hp", { length: 20 }).notNull(),
    /** Snapshot kamar yang ditinggalkan (null bila belum pernah dapat kamar). */
    noKamar: varchar("no_kamar", { length: 50 }),
    tipeKamar: varchar("tipe_kamar", { length: 100 }),
    hargaSewa: integer("harga_sewa"),
    tglMasuk: date("tgl_masuk", { mode: "date" }).notNull(),
    /** Tanggal data dipindahkan ke arsip (tanggal keluar penghuni). */
    tglKeluar: date("tgl_keluar", { mode: "date" }).notNull(),
    /** Pemicu pengarsipan (lihat enum `alasan_arsip`). */
    alasan: alasanArsipEnum("alasan").notNull(),
    /** Ringkasan keuangan saat keluar (dibekukan, tidak ikut berubah). */
    jumlahPembayaran: integer("jumlah_pembayaran").notNull().default(0),
    totalPembayaran: integer("total_pembayaran").notNull().default(0),
    totalTunggakan: integer("total_tunggakan").notNull().default(0),
    /** Periode terakhir yang sudah Lunas, mis. "September 2026". */
    periodeTerakhir: varchar("periode_terakhir", { length: 50 }),
    /** Salinan seluruh riwayat pembayaran milik penghuni. */
    riwayatPembayaran: jsonb("riwayat_pembayaran")
      .$type<RiwayatPembayaranArsip[]>()
      .notNull()
      .default([]),
    /** Catatan tambahan saat keluar (mis. alasan dari penghuni/pengelola). */
    catatan: text("catatan"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("arsip_penghuni_id_penghuni_idx").on(table.idPenghuni),
    index("arsip_penghuni_tgl_keluar_idx").on(table.tglKeluar),
  ]
);

/* ================================================================
 * Relations (untuk query relasional Drizzle)
 * ================================================================ */

export const kamarRelations = relations(kamar, ({ many }) => ({
  penghuni: many(penghuni),
}));

export const penghuniRelations = relations(penghuni, ({ one, many }) => ({
  kamar: one(kamar, {
    fields: [penghuni.idKamar],
    references: [kamar.id],
  }),
  pembayaran: many(pembayaran),
  transaksiOnline: many(transaksiOnline),
  pengaduan: many(pengaduan),
  arsip: many(arsipPenghuni),
}));

export const arsipPenghuniRelations = relations(arsipPenghuni, ({ one }) => ({
  penghuni: one(penghuni, {
    fields: [arsipPenghuni.idPenghuni],
    references: [penghuni.id],
  }),
}));

export const pengaduanRelations = relations(pengaduan, ({ one }) => ({
  penghuni: one(penghuni, {
    fields: [pengaduan.idPenghuni],
    references: [penghuni.id],
  }),
}));

export const pembayaranRelations = relations(pembayaran, ({ one }) => ({
  penghuni: one(penghuni, {
    fields: [pembayaran.idPenghuni],
    references: [penghuni.id],
  }),
}));

export const transaksiOnlineRelations = relations(transaksiOnline, ({ one }) => ({
  penghuni: one(penghuni, {
    fields: [transaksiOnline.idPenghuni],
    references: [penghuni.id],
  }),
}));

/* ================================================================
 * Infer Types
 * ================================================================ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Kamar = typeof kamar.$inferSelect;
export type NewKamar = typeof kamar.$inferInsert;

export type Penghuni = typeof penghuni.$inferSelect;
export type NewPenghuni = typeof penghuni.$inferInsert;

export type Pembayaran = typeof pembayaran.$inferSelect;
export type NewPembayaran = typeof pembayaran.$inferInsert;

export type Notifikasi = typeof notifikasi.$inferSelect;
export type NewNotifikasi = typeof notifikasi.$inferInsert;

export type Pengaduan = typeof pengaduan.$inferSelect;
export type NewPengaduan = typeof pengaduan.$inferInsert;

export type TransaksiOnline = typeof transaksiOnline.$inferSelect;
export type NewTransaksiOnline = typeof transaksiOnline.$inferInsert;

export type ArsipPenghuni = typeof arsipPenghuni.$inferSelect;
export type NewArsipPenghuni = typeof arsipPenghuni.$inferInsert;
