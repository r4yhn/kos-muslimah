import { eq } from "drizzle-orm";

import { db } from "@/db";
import { kamar, penghuni } from "@/db/schema";

export type KamarPilihan = {
  id: string;
  noKamar: string;
  statusKamar: string;
  hargaSewa: number;
};

type OpsiKamar = {
  /**
   * Saat menyunting penghuni tertentu (opsional): reservasi kamar miliknya
   * sendiri tidak dianggap "dipesan orang lain", sehingga tetap muncul di
   * daftar pilihan.
   */
  kecualiPenghuniId?: string;
  /** Kamar yang sedang ditempati penghuni tsb — selalu disertakan. */
  termasukKamarId?: string;
};

/**
 * Daftar kamar yang benar-benar dapat ditempati oleh penghuni:
 * - kamar yang sedang ditempati penghuni tsb (opsional `termasukKamarId`);
 * - kamar berstatus "Tersedia" yang tidak sedang "dipesan" penghuni lain
 *   yang masih menunggu pembayaran awal (perlu_bayar_awal = true).
 *
 * Aturan Bayar di Awal: kamar penghuni baru ber-akun belum langsung berstatus
 * "Terisi", tetapi juga tidak boleh dipesan dua kali oleh penghuni lain.
 */
export async function kamarBisaDitempati(
  opsi: OpsiKamar = {}
): Promise<KamarPilihan[]> {
  const [daftarKamar, daftarDipesan] = await Promise.all([
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
      .where(eq(penghuni.perluBayarAwal, true)),
  ]);

  const reservasiPerKamar = new Map<string, string>(); // kamarId -> penghuniId
  for (const row of daftarDipesan) {
    if (row.idKamar && !reservasiPerKamar.has(row.idKamar)) {
      reservasiPerKamar.set(row.idKamar, row.idPenghuni);
    }
  }

  return daftarKamar.filter((kamarRow) => {
    // Kamar yang sedang ditempati penghuni tsb selalu boleh dipilih.
    if (kamarRow.id === opsi.termasukKamarId) return true;

    if (kamarRow.statusKamar !== "Tersedia") return false;

    const pemesan = reservasiPerKamar.get(kamarRow.id);
    // Tidak dipesan -> bebas. Dipesan -> hanya pemesan itu sendiri yang boleh
    // tetap melihatnya (saat menyunting data penghuni tsb).
    return pemesan === undefined || pemesan === opsi.kecualiPenghuniId;
  });
}
