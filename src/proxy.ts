/**
 * Proxy (Next.js 16 — pengganti middleware.ts).
 *
 * Auth.js rekomendasi: cukup re-export `auth` dari `@/auth`.
 * Callback `authorized` di auth.ts yang menangani proteksi route.
 */
export { auth as proxy } from "@/auth";

/**
 * Jalankan proxy hanya pada route aplikasi.
 * `api/auth` (endpoint Auth.js), webhook payment gateway (`api/payment`),
 * cron, aset statis, dan file gambar dilewati.
 */
export const config = {
  matcher: [
    "/((?!api/auth|api/payment|api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
