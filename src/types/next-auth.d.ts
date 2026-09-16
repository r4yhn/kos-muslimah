import type { DefaultSession } from "next-auth";

/** Peran akun yang dikenali aplikasi. */
export type UserRole = "admin" | "penghuni";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Peran akun; admin = pengelola panel, penghuni = portal mandiri. */
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
