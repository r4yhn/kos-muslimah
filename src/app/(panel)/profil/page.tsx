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
 * Halaman ubah password & profil untuk pengelola (role `admin`).
 * Ganti nama/email disertai penyegaran sesi JWT (`unstable_update`) supaya header
 * langsung memakai identitas terbaru.
 */
export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect(berandaPeran(session.user.role));

  const profil = await ambilProfilAkun(session.user.id);
  if (!profil) redirect("/login");

  return <ProfilAkunView profil={profil} area="panel" />;
}
