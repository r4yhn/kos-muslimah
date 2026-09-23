import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ProfilAkunView } from "@/components/profil-akun";
import { ambilProfilAkun } from "@/lib/profil";
import { berandaPeran } from "@/lib/role";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profil & Password",
};

/**
 * Halaman ubah password & profil untuk Pemilik Kos (`/monitoring/profil`).
 *
 * Ini satu-satunya halaman di area pemantauan yang menulis ke database, dan
 * hanya untuk **akun milik pemilik sendiri** (nama/email/password) — data kos
 * tetap read-only.
 */
export default async function MonitoringProfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "pemilik") {
    redirect(berandaPeran(session.user.role));
  }

  const profil = await ambilProfilAkun(session.user.id);
  if (!profil) redirect("/login");

  return <ProfilAkunView profil={profil} area="monitoring" />;
}
