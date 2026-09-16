CREATE TABLE "transaksi_online" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(64) NOT NULL,
	"id_penghuni" uuid NOT NULL,
	"tipe" varchar(20) NOT NULL,
	"nominal" integer NOT NULL,
	"status_midtrans" varchar(20) DEFAULT 'pending' NOT NULL,
	"snap_token" text,
	"redirect_url" text,
	"metode_bayar" varchar(50),
	"detail" jsonb DEFAULT '{"periode":[],"label":""}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaksi_online_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "transaksi_online" ADD CONSTRAINT "transaksi_online_id_penghuni_penghuni_id_fk" FOREIGN KEY ("id_penghuni") REFERENCES "public"."penghuni"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaksi_online_id_penghuni_idx" ON "transaksi_online" USING btree ("id_penghuni");--> statement-breakpoint
CREATE INDEX "transaksi_online_status_idx" ON "transaksi_online" USING btree ("status_midtrans");