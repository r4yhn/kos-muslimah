import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "admin" | "penghuni") ?? "admin";
      }
      return session;
    },

    /**
     * Proteksi route via Proxy (Next.js 16):
     * - Belum login & bukan /login      -> redirect ke /login (return false)
     * - Sudah login & mengunjungi /login -> redirect ke beranda sesuai role
     * - Role "penghuni" hanya boleh di /portal* (pembayaran awal, riwayat);
     *   role "admin" hanya boleh di panel /dashboard, /kamar, /penghuni,
     *   /pembayaran, /laporan. Jika menyeberang, redirect ke beranda
     *   masing-masing.
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
          ? Response.redirect(
              new URL(role === "penghuni" ? "/portal" : "/dashboard", nextUrl)
            )
          : true;
      }

      const PANEL_PATHS = [
        "/dashboard",
        "/kamar",
        "/penghuni",
        "/pembayaran",
        "/laporan",
        "/notifikasi",
      ];
      const isPanelPath = PANEL_PATHS.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
      );
      const isPortalPath = pathname === "/portal" || pathname.startsWith("/portal/");

      if (isLoginPage) {
        if (isLoggedIn) {
          const beranda = role === "penghuni" ? "/portal" : "/dashboard";
          return Response.redirect(new URL(beranda, nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        return false;
      }

      // Pisahkan area berdasarkan role.
      if (isPortalPath && role !== "penghuni") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      if (isPanelPath && role !== "admin") {
        return Response.redirect(new URL("/portal", nextUrl));
      }

      return true;
    },
  },
});
