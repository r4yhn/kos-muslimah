ALTER TYPE "public"."status_bayar" ADD VALUE 'Menunggu Konfirmasi' BEFORE 'Belum Lunas';--> statement-breakpoint
ALTER TABLE "pembayaran" ADD COLUMN "bukti_pembayaran" text;--> statement-breakpoint
ALTER TABLE "pembayaran" ADD COLUMN "kelompok_konfirmasi" uuid;