import { and, count, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import { namaBulan } from "./format";
import { hariIniUtc, sudahTerlambat } from "./tagihan";

/**
 * Rekapitulasi Laporan Keuangan (halaman admin `/laporan` + export PDF
 * `/api/laporan/keuangan`).
 *
 * Sumber tunggal: tabel `pembayaran` — satu baris = satu periode sewa seorang
 * penghuni. Arti statusnya bagi laporan:
 * - `Lunas`               -> pendapatan yang benar-benar diterima (kas masuk);
 * - `Menunggu Konfirmasi` -> bukti sudah dikirim penghuni (data lama/legacy),
 *                           menanti verifikasi admin sehingga **belum** diakui
 *                           sebagai pendapatan;
 * - `Belum Lunas`         -> tagihan otomatis/manual yang masih menjadi piutang.
 *
 * Semua angka mengikuti rentang bulan (`dari`–`sampai`) pada satu tahun yang
 * dipilih, sehingga laporan bulanan, kuartalan, maupun tahunan konsisten.
 *
 * File ini hanya boleh dipakai dari server (server component / route handler)
 * karena mengakses database.
 */

/** Rekap satu bulan: pendapatan, piutang, pengajuan, & nilai tercatat. */
export type RekapBulanKeuangan = {
  bulan: number;
  /** Nama bulan Indonesia, mis. "September". */
  label: string;
  transaksi: number;
  lunasJumlah: number;
  lunasNominal: number;
  menungguJumlah: number;
  menungguNominal: number;
  belumJumlah: number;
  belumNominal: number;
  /** Lunas + Menunggu Konfirmasi + Belum Lunas (seluruh nilai yang tercatat). */
  totalNominal: number;
};

/** Pendapatan Lunas yang dikelompokkan per metode bayar. */
export type RekapMetodeKeuangan = {
  metode: string;
  transaksi: number;
  nominal: number;
};

/** Tunggakan (piutang) satu penghuni pada rentang periode terpilih. */
export type TunggakanKeuangan = {
  idPenghuni: string;
  nama: string;
  kamarNo: string | null;
  jumlahTagihan: number;
  nominal: number;
  /** Jatuh tempo paling awal di antara tagihan yang belum lunas. */
  jatuhTempoTerawal: Date | null;
  /** True bila minimal satu tagihan sudah melewati jatuh tempo. */
  terlambat: boolean;
};

export type RingkasanKeuangan = {
  transaksi: number;
  lunasJumlah: number;
  lunasNominal: number;
  menungguJumlah: number;
  menungguNominal: number;
  belumJumlah: number;
  belumNominal: number;
  totalNominal: number;
  tunggakanJumlah: number;
  tunggakanNominal: number;
  terlambatJumlah: number;
  terlambatNominal: number;
};

export type RekapKeuangan = {
  tahun: number;
  dari: number;
  sampai: number;
  /** Label siap tampil, mis. "Januari – Maret 2026" atau "Tahun 2026". */
  labelPeriode: string;
  ringkasan: RingkasanKeuangan;
  /** Satu entri untuk setiap bulan pada rentang (bulan kosong tetap muncul). */
  perBulan: RekapBulanKeuangan[];
  perMetode: RekapMetodeKeuangan[];
  /** Tunggakan per penghuni, nominal terbesar lebih dahulu. */
  tunggakan: TunggakanKeuangan[];
  penghuniAktif: number;
};

/**
 * Normalisasi input bulan pengguna (1–12). Mengembalikan `bawaan` bila nilai
 * kosong/tidak valid supaya filter laporan selalu berada pada rentang aman.
 */
export function bulanLaporan(nilai: unknown, bawaan: number): number {
  const angka =
    typeof nilai === "string" || typeof nilai === "number"
      ? Number(String(nilai).trim())
      : NaN;
  return Number.isInteger(angka) && angka >= 1 && angka <= 12 ? angka : bawaan;
}

/** Normalisasi input tahun pengguna (4 digit, 2000–2100). */
export function tahunLaporan(nilai: unknown, bawaan: number): number {
  const angka =
    typeof nilai === "string" || typeof nilai === "number"
      ? Number(String(nilai).trim())
      : NaN;
  return Number.isInteger(angka) && angka >= 2000 && angka <= 2100
    ? angka
    : bawaan;
}

/** Label periode laporan, mis. "Januari – Maret 2026" atau "Tahun 2026". */
export function labelPeriodeKeuangan(
  dari: number,
  sampai: number,
  tahun: number
): string {
  if (dari === sampai) return `${namaBulan(dari)} ${tahun}`;
  if (dari === 1 && sampai === 12) return `Tahun ${tahun}`;
  return `${namaBulan(dari)} – ${namaBulan(sampai)} ${tahun}`;
}


function ringkasanKosong(): RingkasanKeuangan {
  return {
    transaksi: 0,
    lunasJumlah: 0,
    lunasNominal: 0,
    menungguJumlah: 0,
    menungguNominal: 0,
    belumJumlah: 0,
    belumNominal: 0,
    totalNominal: 0,
    tunggakanJumlah: 0,
    tunggakanNominal: 0,
    terlambatJumlah: 0,
    terlambatNominal: 0,
  };
}

/**
 * Hitung rekapitulasi keuangan untuk satu tahun + rentang bulan.
 *
 * @returns Ringkasan total, rekap per bulan, rekap pendapatan per metode bayar,
 *          daftar tunggakan per penghuni, dan jumlah penghuni aktif.
 */
export async function rekapKeuangan({
  tahun,
  dari,
  sampai,
}: {
  tahun: number;
  dari: number;
  sampai: number;
}): Promise<RekapKeuangan> {
  const awal = bulanLaporan(dari, 1);
  const akhir = Math.max(awal, bulanLaporan(sampai, 12));

  const [rows, aktifRows] = await Promise.all([
    db
      .select({
        idPenghuni: pembayaran.idPenghuni,
        bulan: pembayaran.bulan,
        jumlahBayar: pembayaran.jumlahBayar,
        metodeBayar: pembayaran.metodeBayar,
        statusBayar: pembayaran.statusBayar,
        jatuhTempo: pembayaran.jatuhTempo,
        nama: penghuni.nama,
        kamarNo: kamar.noKamar,
      })
      .from(pembayaran)
      .innerJoin(penghuni, eq(penghuni.id, pembayaran.idPenghuni))
      .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
      .where(
        and(
          eq(pembayaran.tahun, tahun),
          gte(pembayaran.bulan, awal),
          lte(pembayaran.bulan, akhir)
        )
      )
      .orderBy(pembayaran.bulan, penghuni.nama),
    db
      .select({ total: count() })
      .from(penghuni)
      .where(eq(penghuni.status, "Aktif")),
  ]);

  // Seluruh bulan pada rentang selalu muncul walau belum ada transaksi.
  const perBulanMap = new Map<number, RekapBulanKeuangan>();
  for (let b = awal; b <= akhir; b++) {
    perBulanMap.set(b, {
      bulan: b,
      label: namaBulan(b),
      transaksi: 0,
      lunasJumlah: 0,
      lunasNominal: 0,
      menungguJumlah: 0,
      menungguNominal: 0,
      belumJumlah: 0,
      belumNominal: 0,
      totalNominal: 0,
    });
  }

  const perMetodeMap = new Map<string, RekapMetodeKeuangan>();
  const tunggakanMap = new Map<string, TunggakanKeuangan>();
  const ringkasan = ringkasanKosong();
  const hariIni = hariIniUtc();

  for (const r of rows) {
    const status = r.statusBayar;
    const nominal = r.jumlahBayar;

    const bulan = perBulanMap.get(r.bulan);
    if (bulan) {
      bulan.transaksi += 1;
      bulan.totalNominal += nominal;
      if (status === "Lunas") {
        bulan.lunasJumlah += 1;
        bulan.lunasNominal += nominal;
      } else if (status === "Menunggu Konfirmasi") {
        bulan.menungguJumlah += 1;
        bulan.menungguNominal += nominal;
      } else {
        bulan.belumJumlah += 1;
        bulan.belumNominal += nominal;
      }
    }

    ringkasan.transaksi += 1;
    ringkasan.totalNominal += nominal;

    if (status === "Lunas") {
      ringkasan.lunasJumlah += 1;
      ringkasan.lunasNominal += nominal;

      // Pendapatan hanya dihitung dari transaksi yang benar-benar dibayar.
      const metode = r.metodeBayar.trim() || "Lainnya";
      const entry =
        perMetodeMap.get(metode) ?? { metode, transaksi: 0, nominal: 0 };
      entry.transaksi += 1;
      entry.nominal += nominal;
      perMetodeMap.set(metode, entry);
      continue;
    }

    if (status === "Menunggu Konfirmasi") {
      ringkasan.menungguJumlah += 1;
      ringkasan.menungguNominal += nominal;
      continue;
    }

    // Sisa: "Belum Lunas" -> tagihan/piutang per penghuni.
    ringkasan.belumJumlah += 1;
    ringkasan.belumNominal += nominal;
    ringkasan.tunggakanJumlah += 1;
    ringkasan.tunggakanNominal += nominal;

    const entry =
      tunggakanMap.get(r.idPenghuni) ??
      ({
        idPenghuni: r.idPenghuni,
        nama: r.nama,
        kamarNo: r.kamarNo,
        jumlahTagihan: 0,
        nominal: 0,
        jatuhTempoTerawal: null,
        terlambat: false,
      } satisfies TunggakanKeuangan);
    entry.jumlahTagihan += 1;
    entry.nominal += nominal;

    if (r.jatuhTempo) {
      if (!entry.jatuhTempoTerawal || r.jatuhTempo < entry.jatuhTempoTerawal) {
        entry.jatuhTempoTerawal = r.jatuhTempo;
      }
      if (sudahTerlambat(r.jatuhTempo, hariIni)) {
        entry.terlambat = true;
        ringkasan.terlambatJumlah += 1;
        ringkasan.terlambatNominal += nominal;
      }
    }

    tunggakanMap.set(r.idPenghuni, entry);
  }

  return {
    tahun,
    dari: awal,
    sampai: akhir,
    labelPeriode: labelPeriodeKeuangan(awal, akhir, tahun),
    ringkasan,
    perBulan: [...perBulanMap.values()],
    perMetode: [...perMetodeMap.values()].sort((a, b) => b.nominal - a.nominal),
    tunggakan: [...tunggakanMap.values()].sort((a, b) => {
      if (b.nominal !== a.nominal) return b.nominal - a.nominal;
      return a.nama.localeCompare(b.nama);
    }),
    penghuniAktif: aktifRows[0]?.total ?? 0,
  };
}
