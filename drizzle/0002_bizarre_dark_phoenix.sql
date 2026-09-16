CREATE TABLE "notifikasi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_user" uuid NOT NULL,
	"judul" varchar(255) NOT NULL,
	"pesan" text NOT NULL,
	"dibaca" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifikasi" ADD CONSTRAINT "notifikasi_id_user_users_id_fk" FOREIGN KEY ("id_user") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifikasi_id_user_idx" ON "notifikasi" USING btree ("id_user");