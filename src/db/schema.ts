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

/** Peran akun: admin (pengelola) / penghuni (portal mandiri) */
export const userRoleEnum = pgEnum("user_role", ["admin", "penghuni"]);

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

export type TransaksiOnline = typeof transaksiOnline.$inferSelect;
export type NewTransaksiOnline = typeof transaksiOnline.$inferInsert;
