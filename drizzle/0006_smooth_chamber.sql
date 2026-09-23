CREATE TYPE "public"."status_pengaduan" AS ENUM('pending', 'diproses', 'selesai');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'pemilik' BEFORE 'penghuni';--> statement-breakpoint
CREATE TABLE "pengaduan" (
	"id_pengaduan" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_penghuni" uuid NOT NULL,
	"deskripsi_kendala" text NOT NULL,
	"tanggal_lapor" date DEFAULT now() NOT NULL,
	"status_penyelesaian" "status_pengaduan" DEFAULT 'pending' NOT NULL,
	"catatan_admin" text,
	"ditangani_pada" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pengaduan" ADD CONSTRAINT "pengaduan_id_penghuni_penghuni_id_fk" FOREIGN KEY ("id_penghuni") REFERENCES "public"."penghuni"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pengaduan_id_penghuni_idx" ON "pengaduan" USING btree ("id_penghuni");--> statement-breakpoint
CREATE INDEX "pengaduan_status_idx" ON "pengaduan" USING btree ("status_penyelesaian");