import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, penghuni, users } from "@/db/schema";
import { sinkronPembayaranAwal } from "./bayar-awal";
import { berandaPeran } from "./role";

/**
 * Konteks portal penghuni (/portal*).
 *
 * Fungsi ini mengembalikan null bila akun role "penghuni" tidak tertaut ke
 * data penghuni manapun (seharusnya tidak terjadi; user dihapus beserta
 * akunnya via ON DELETE CASCADE). Redirect dilakukan untuk masalah sesi/role.
 */
export type PortalData = {
  userId: string;
  email: string;
  nama: string;
  penghuniId: string;
  tglMasuk: Date;
  status: string;
  idKamar: string | null;
  noKamar: string | null;
  hargaSewa: number | null;
  statusKamar: string | null;
  /** true = wajib menyelesaikan Pembayaran Awal (menu lain terkunci). */
  terkunci: boolean;
};

export async function getPortalData(): Promise<PortalData | null> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "penghuni") redirect(berandaPeran(session.user.role));

  const [akun] = await db
    .select({ id: users.id, email: users.email, idPenghuni: users.idPenghuni })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!akun || !akun.idPenghuni) return null;

  // Jaga konsistensi: bila pembayaran Lunas periode awal ternyata sudah ada
  // (mis. dicatat admin terlebih dahulu), kunci dibuka & kamar diaktifkan.
  await sinkronPembayaranAwal(akun.idPenghuni);

  const [row] = await db
    .select({
      id: penghuni.id,
      nama: penghuni.nama,
      tglMasuk: penghuni.tglMasuk,
      status: penghuni.status,
      perluBayarAwal: penghuni.perluBayarAwal,
      idKamar: penghuni.idKamar,
      noKamar: kamar.noKamar,
      hargaSewa: kamar.hargaSewa,
      statusKamar: kamar.statusKamar,
    })
    .from(penghuni)
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .where(eq(penghuni.id, akun.idPenghuni))
    .limit(1);

  if (!row) return null;

  return {
    userId: akun.id,
    email: akun.email,
    nama: row.nama,
    penghuniId: row.id,
    tglMasuk: row.tglMasuk,
    status: row.status,
    idKamar: row.idKamar,
    noKamar: row.noKamar,
    hargaSewa: row.hargaSewa,
    statusKamar: row.statusKamar,
    terkunci: row.perluBayarAwal,
  };
}
