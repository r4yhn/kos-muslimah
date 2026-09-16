import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { client, db } from "./index";
import { users } from "./schema";

async function main() {
  const name = (process.env.SEED_ADMIN_NAME ?? "Admin Kos Pondok Muslimah").trim();
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";

  if (!email) {
    console.error(
      "SEED_ADMIN_EMAIL belum diisi. Contoh:\n" +
        "  SEED_ADMIN_EMAIL=admin@kosmuslimah.com npm run db:seed"
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error(
      "SEED_ADMIN_PASSWORD wajib minimal 8 karakter. Contoh:\n" +
        "  SEED_ADMIN_PASSWORD='rahasia123' npm run db:seed"
    );
    process.exit(1);
  }

  console.log("Menyiapkan akun admin...");
  console.log(`  Nama  : ${name}`);
  console.log(`  Email : ${email}`);

  const passwordHash = await bcrypt.hash(password, 10);

  const inserted = await db
    .insert(users)
    .values({
      name,
      email,
      password: passwordHash,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    });

  if (inserted.length > 0) {
    console.log("✅ Seed admin berhasil:");
    console.log(inserted[0]);
  } else {
    const existing = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    console.log(
      existing.length > 0
        ? `ℹ️  User dengan email "${email}" sudah ada (id: ${existing[0].id}). Tidak ada perubahan.`
        : "ℹ️  Tidak ada baris yang di-insert (email sudah terdaftar)."
    );
  }
}

main()
  .catch((error) => {
    console.error("❌ Seed gagal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
