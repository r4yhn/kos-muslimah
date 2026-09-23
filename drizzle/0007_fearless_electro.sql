CREATE TYPE "public"."alasan_arsip" AS ENUM('Proses Keluar', 'Habis Masa Sewa');--> statement-breakpoint
CREATE TABLE "arsip_penghuni" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_penghuni" uuid,
	"nama" varchar(255) NOT NULL,
	"jenis_kelamin" varchar(20) NOT NULL,
	"alamat" text NOT NULL,
	"no_hp" varchar(20) NOT NULL,
	"no_kamar" varchar(50),
	"tipe_kamar" varchar(100),
	"harga_sewa" integer,
	"tgl_masuk" date NOT NULL,
	"tgl_keluar" date NOT NULL,
	"alasan" "alasan_arsip" NOT NULL,
	"jumlah_pembayaran" integer DEFAULT 0 NOT NULL,
	"total_pembayaran" integer DEFAULT 0 NOT NULL,
	"total_tunggakan" integer DEFAULT 0 NOT NULL,
	"periode_terakhir" varchar(50),
	"riwayat_pembayaran" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arsip_penghuni" ADD CONSTRAINT "arsip_penghuni_id_penghuni_penghuni_id_fk" FOREIGN KEY ("id_penghuni") REFERENCES "public"."penghuni"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arsip_penghuni_id_penghuni_idx" ON "arsip_penghuni" USING btree ("id_penghuni");--> statement-breakpoint
CREATE INDEX "arsip_penghuni_tgl_keluar_idx" ON "arsip_penghuni" USING btree ("tgl_keluar");