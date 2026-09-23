import { eq } from "drizzle-orm";

import { db } from "@/db";
import { kamar, penghuni } from "@/db/schema";
import { KAPASITAS_KAMAR } from "./kapasitas-kamar";

export { KAPASITAS_KAMAR };

export type KamarPilihan = {
  id: string;
  noKamar: string;
  statusKamar: string;
  hargaSewa: number;
  /** Jumlah penghuni aktif (termasuk yang masih menunggu Pembayaran Awal). */
  terisi: number;
  /** Sisa slot yang masih bisa ditempati (KAPASITAS_KAMAR − terisi). */
  sisaSlot: number;
};

type OpsiKamar = {
  /**
   * Saat menyunting penghuni tertentu (opsional): slot milik penghuni itu
   * sendiri tidak dihitung, sehingga kamarnya tetap tampil sebagai pilihan.
   */
  kecualiPenghuniId?: string;
  /** Kamar yang sedang ditempati penghuni tsb — selalu disertakan. */
  termasukKamarId?: string;
};

/**
 * Daftar kamar yang masih dapat ditempati oleh penghuni.
 *
 * Aturan kapasitas (maksimal `KAPASITAS_KAMAR` = 2 penghuni per kamar):
 * - penghuni berstatus **Aktif** menempati satu slot, termasuk penghuni baru
 *   yang masih menunggu Pembayaran Awal (slot "dipesan" agar tidak dipesan
 *   berlebihan), sedangkan penghuni berstatus "Keluar" tidak dihitung;
 * - kamar berstatus **Perbaikan** tidak dapat dipilih;
 * - kamar yang sudah penuh (2 penghuni) tidak dapat dipilih lagi;
 * - kamar milik penghuni yang sedang disunting selalu disertakan.
 *
 * Status kamar (Tersedia/Terisi) tidak lagi menjadi penentu, karena satu kamar
 * boleh dihuni sampai 2 orang — masing-masing dengan akun portal sendiri.
 *
 * File ini hanya boleh dipakai dari server (mengakses database).
 */
export async function kamarBisaDitempati(
  opsi: OpsiKamar = {}
): Promise<KamarPilihan[]> {
  const [daftarKamar, daftarPenghuniAktif] = await Promise.all([
    db
      .select({
        id: kamar.id,
        noKamar: kamar.noKamar,
        statusKamar: kamar.statusKamar,
        hargaSewa: kamar.hargaSewa,
      })
      .from(kamar)
      .orderBy(kamar.noKamar),
    db
      .select({
        idPenghuni: penghuni.id,
        idKamar: penghuni.idKamar,
      })
      .from(penghuni)
      .where(eq(penghuni.status, "Aktif")),
  ]);

  const terisiPerKamar = new Map<string, number>();
  const kamarPerPenghuni = new Map<string, string>();
  for (const p of daftarPenghuniAktif) {
    if (!p.idKamar) continue;
    terisiPerKamar.set(p.idKamar, (terisiPerKamar.get(p.idKamar) ?? 0) + 1);
    kamarPerPenghuni.set(p.idPenghuni, p.idKamar);
  }

  return daftarKamar
    .map((k) => {
      // Saat menyunting, slot milik penghuni itu sendiri tidak dihitung.
      const slotSendiri =
        opsi.kecualiPenghuniId &&
        kamarPerPenghuni.get(opsi.kecualiPenghuniId) === k.id
          ? 1
          : 0;
      const terisi = Math.max(0, (terisiPerKamar.get(k.id) ?? 0) - slotSendiri);
      return {
        ...k,
        terisi,
        sisaSlot: Math.max(0, KAPASITAS_KAMAR - terisi),
      };
    })
    .filter((k) => {
      // Kamar yang sedang ditempati penghuni tsb selalu boleh dipilih.
      if (k.id === opsi.termasukKamarId) return true;
      if (k.statusKamar === "Perbaikan") return false;
      return k.sisaSlot > 0;
    });
}

