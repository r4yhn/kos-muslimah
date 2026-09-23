import type { DefaultSession } from "next-auth";

/**
 * Peran akun yang dikenali aplikasi:
 * - `admin`    -> pengelola panel (punya akses ubah data);
 * - `pemilik`  -> Pemilik Kos: pemantauan read-only di `/monitoring`;
 * - `penghuni` -> portal mandiri `/portal`.
 */
export type UserRole = "admin" | "pemilik" | "penghuni";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Peran akun; admin = pengelola panel, pemilik = pemantau, penghuni = portal. */
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
