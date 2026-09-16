CREATE TYPE "public"."status_bayar" AS ENUM('Lunas', 'Belum Lunas');--> statement-breakpoint
CREATE TYPE "public"."status_kamar" AS ENUM('Tersedia', 'Terisi', 'Perbaikan');--> statement-breakpoint
CREATE TYPE "public"."status_penghuni" AS ENUM('Aktif', 'Keluar');--> statement-breakpoint
CREATE TABLE "kamar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"no_kamar" varchar(50) NOT NULL,
	"tipe_kamar" varchar(100) NOT NULL,
	"harga_sewa" integer NOT NULL,
	"status_kamar" "status_kamar" DEFAULT 'Tersedia' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kamar_no_kamar_unique" UNIQUE("no_kamar")
);
--> statement-breakpoint
CREATE TABLE "pembayaran" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_penghuni" uuid NOT NULL,
	"tanggal_bayar" date NOT NULL,
	"bulan" integer NOT NULL,
	"tahun" integer NOT NULL,
	"jumlah_bayar" integer NOT NULL,
	"metode_bayar" varchar(50) NOT NULL,
	"keterangan" text,
	"status_bayar" "status_bayar" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pembayaran_bulan_check" CHECK ("pembayaran"."bulan" BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE "penghuni" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_kamar" uuid,
	"nama" varchar(255) NOT NULL,
	"jenis_kelamin" varchar(20) NOT NULL,
	"alamat" text NOT NULL,
	"no_hp" varchar(20) NOT NULL,
	"tgl_masuk" date NOT NULL,
	"status" "status_penghuni" DEFAULT 'Aktif' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "pembayaran" ADD CONSTRAINT "pembayaran_id_penghuni_penghuni_id_fk" FOREIGN KEY ("id_penghuni") REFERENCES "public"."penghuni"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penghuni" ADD CONSTRAINT "penghuni_id_kamar_kamar_id_fk" FOREIGN KEY ("id_kamar") REFERENCES "public"."kamar"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pembayaran_bulan_tahun_idx" ON "pembayaran" USING btree ("bulan","tahun");