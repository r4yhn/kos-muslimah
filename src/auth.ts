import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { berandaPeran } from "@/lib/role";
import type { UserRole } from "@/types/next-auth";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  pages: {
    signIn: "/login",
  },

  /**
   * Credentials -> sesi disimpan di JWT (tanpa adapter database).
   */
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawEmail = credentials?.email as string | undefined;
        const rawPassword = credentials?.password as string | undefined;

        if (!rawEmail || !rawPassword) return null;

        const email = rawEmail.trim().toLowerCase();

        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            password: users.password,
            role: users.role,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) return null;

        const passwordValid = await bcrypt.compare(rawPassword, user.password);
        if (!passwordValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      /**
       * Dipicu `unstable_update()` dari halaman profil (`/profil` untuk admin,
       * `/monitoring/profil` untuk pemilik) setelah identitas akun diubah,
       * supaya header & sesi langsung memakai nama/email terbaru tanpa perlu
       * login ulang.
       */
      if (trigger === "update") {
        const data = session as { user?: { name?: string; email?: string } } | null;
        const namaBaru = data?.user?.name;
        const emailBaru = data?.user?.email;
        if (typeof namaBaru === "string" && namaBaru.trim()) {
          token.name = namaBaru.trim();
        }
        if (typeof emailBaru === "string" && emailBaru.trim()) {
          token.email = emailBaru.trim();
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole) ?? "admin";
      }
      return session;
    },

    /**
     * Proteksi route via Proxy (Next.js 16):
     * - Belum login & bukan halaman publik -> redirect ke /login (return false)
     * - Sudah login & mengunjungi /login    -> redirect ke beranda sesuai role
     * - Tiap peran hanya boleh di areanya:
     *     `admin`    -> panel `/dashboard`, `/kamar`, `/penghuni`,
     *                   `/pembayaran`, `/laporan`, `/pengaduan`, `/notifikasi`,
     *                   `/profil`, `/akun`;
     *     `pemilik`  -> area pemantauan read-only `/monitoring*`
     *                   (termasuk `/monitoring/profil`);
     *     `penghuni` -> portal `/portal*`.
     *   Bila menyeberang, sistem mengalihkan ke beranda peran masing-masing.
     *
     * Catatan: JWT lama (sebelum fitur role) tidak punya klaim role -> saat
     * itu seluruh akun memang admin, sehingga diperlakukan sebagai admin.
     */
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const role = session?.user?.role ?? "admin";
      const { nextUrl } = request;
      const pathname = nextUrl.pathname;
      const isLoginPage = pathname.startsWith("/login");

      // Halaman pendaftaran/aktivasi akun penghuni bersifat publik (tanpa login):
      // - /daftar            -> penghuni BARU (pilih kamar + Pembayaran Awal)
      // - /daftar-penghuni   -> penghuni yang SUDAH terdata pengelola tetapi
      //                         belum punya akun (email/password sendiri)
      // Pengguna yang sudah login tidak perlu mendaftar lagi.
      const isDaftarPage = pathname === "/daftar";
      const isAktifkanPage = pathname === "/daftar-penghuni";
      if (isDaftarPage || isAktifkanPage) {
        return isLoggedIn
          ? Response.redirect(new URL(berandaPeran(role), nextUrl))
          : true;
      }

      const PANEL_PATHS = [
        "/dashboard",
        "/kamar",
        "/penghuni",
        "/pembayaran",
        "/laporan",
        "/pengaduan",
        "/notifikasi",
        "/profil",
        "/akun",
      ];
      const isPanelPath = PANEL_PATHS.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
      );
      const isPortalPath = pathname === "/portal" || pathname.startsWith("/portal/");
      const isMonitoringPath =
        pathname === "/monitoring" || pathname.startsWith("/monitoring/");

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL(berandaPeran(role), nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        return false;
      }

      // Pisahkan area berdasarkan role.
      if (isPortalPath && role !== "penghuni") {
        return Response.redirect(new URL(berandaPeran(role), nextUrl));
      }
      if (isPanelPath && role !== "admin") {
        return Response.redirect(new URL(berandaPeran(role), nextUrl));
      }
      if (isMonitoringPath && role !== "pemilik") {
        return Response.redirect(new URL(berandaPeran(role), nextUrl));
      }

      return true;
    },
  },
});
