ALTER TABLE "pembayaran" ALTER COLUMN "tanggal_bayar" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pembayaran" ADD COLUMN "jatuh_tempo" date;