import type { UserRole } from "@/types/next-auth";

/**
 * Helper peran akun (`users.role`) — dipakai lintas area: proxy/Auth.js,
 * layout panel, layout portal, dan layout monitoring.
 *
 * Peta area aplikasi per peran:
 * - `admin`    -> panel pengelola `/dashboard` (baca + ubah data);
 * - `pemilik`  -> area pemantauan `/monitoring` (**read-only**);
 * - `penghuni` -> portal penghuni `/portal`.
 *
 * File ini bebas dari akses database supaya aman diimpor dari `auth.ts`
 * (dipakai Proxy/edge) maupun server component.
 */

/** Halaman beranda (landing) tiap peran setelah login. */
export const BERANDA_ROLE: Record<UserRole, string> = {
  admin: "/dashboard",
  pemilik: "/monitoring",
  penghuni: "/portal",
};

/** Label manusiawi tiap peran untuk ditampilkan di header. */
export const LABEL_ROLE: Record<UserRole, string> = {
  admin: "Pengelola",
  pemilik: "Pemilik Kos",
  penghuni: "Penghuni",
};

/**
 * Beranda sesuai peran. JWT lama (sebelum fitur role) tidak punya klaim role —
 * saat itu seluruh akun memang admin, sehingga default-nya `admin`.
 */
export function berandaPeran(role: UserRole | null | undefined): string {
  return BERANDA_ROLE[role ?? "admin"] ?? BERANDA_ROLE.admin;
}

/** True bila peran termasuk pemilik data (boleh menambah/mengubah/menghapus). */
export function bolehMengubahData(role: UserRole | null | undefined): boolean {
  return role === "admin";
}
