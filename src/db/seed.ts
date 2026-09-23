import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { client, db } from "./index";
import { users } from "./schema";

/**
 * Buat/lewati satu akun pengguna dengan peran tertentu (idempotent).
 * Role yang dikenali: `admin` (pengelola) & `pemilik` (pemantau read-only).
 */
async function seedAkun(opsi: {
  peran: "admin" | "pemilik";
  label: string;
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  const { peran, label, name, email, password } = opsi;

  console.log(`Menyiapkan akun ${label}...`);
  console.log(`  Nama  : ${name}`);
  console.log(`  Email : ${email}`);
  console.log(`  Peran : ${peran}`);

  const passwordHash = await bcrypt.hash(password, 10);

  const inserted = await db
    .insert(users)
    .values({ name, email, password: passwordHash, role: peran })
    .onConflictDoNothing({ target: users.email })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    });

  if (inserted.length > 0) {
    console.log(`✅ Seed akun ${label} berhasil:`);
    console.log(inserted[0]);
    return;
  }

  const existing = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  console.log(
    existing.length > 0
      ? `ℹ️  User dengan email "${email}" sudah ada (id: ${existing[0].id}, role: ${existing[0].role}). Tidak ada perubahan.`
      : "ℹ️  Tidak ada baris yang di-insert (email sudah terdaftar)."
  );
}

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

  await seedAkun({
    peran: "admin",
    label: "admin",
    name,
    email,
    password,
  });

  // --- Akun Pemilik Kos (opsional) -------------------------------
  // Pemilik Kos memakai area pemantauan read-only `/monitoring`.
  const pemilikEmail = (process.env.SEED_PEMILIK_EMAIL ?? "")
    .trim()
    .toLowerCase();
  const pemilikPassword = process.env.SEED_PEMILIK_PASSWORD ?? "";
  const pemilikName = (
    process.env.SEED_PEMILIK_NAME ?? "Pemilik Kos Pondok Muslimah"
  ).trim();

  // Tanpa dua variabel ini, seed hanya menyiapkan akun admin.
  if (!pemilikEmail && !pemilikPassword) return;

  if (!pemilikEmail || pemilikPassword.length < 8) {
    console.error(
      "SEED_PEMILIK_EMAIL dan SEED_PEMILIK_PASSWORD wajib diisi bersamaan " +
        "(password minimal 8 karakter)."
    );
    process.exit(1);
  }

  await seedAkun({
    peran: "pemilik",
    label: "pemilik kos",
    name: pemilikName,
    email: pemilikEmail,
    password: pemilikPassword,
  });
}

main()
  .catch((error) => {
    console.error("❌ Seed gagal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
