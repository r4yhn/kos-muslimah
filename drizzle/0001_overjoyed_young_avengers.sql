CREATE TYPE "public"."user_role" AS ENUM('admin', 'penghuni');--> statement-breakpoint
ALTER TABLE "penghuni" ADD COLUMN "perlu_bayar_awal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "id_penghuni" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_penghuni_penghuni_id_fk" FOREIGN KEY ("id_penghuni") REFERENCES "public"."penghuni"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_penghuni_unique" UNIQUE("id_penghuni");