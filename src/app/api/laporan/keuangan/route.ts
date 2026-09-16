import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

import { auth } from "@/auth";
import { formatTanggal } from "@/lib/format";
import { bulanLaporan, rekapKeuangan, tahunLaporan } from "@/lib/keuangan";
import {
  LaporanKeuanganDoc,
  type LaporanKeuanganRingkasan,
} from "@/lib/laporan";

export const dynamic = "force-dynamic";

/**
 * GET /api/laporan/keuangan?tahun=&dari=&sampai=
 * Unduh PDF laporan keuangan (rekap pendapatan per bulan & per metode bayar,
 * ringkasan piutang, serta daftar tunggakan per penghuni) sesuai filter.
 *
 * `dari`/`sampai` adalah bulan (1–12); kosong berarti Januari s.d. Desember.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "penghuni") {
    return new Response("Tidak diizinkan", { status: 401 });
  }

  const url = new URL(request.url);
  const tahun = tahunLaporan(
    url.searchParams.get("tahun"),
    new Date().getFullYear()
  );
  const dari = bulanLaporan(url.searchParams.get("dari"), 1);
  const sampai = Math.max(dari, bulanLaporan(url.searchParams.get("sampai"), 12));

  const rekap = await rekapKeuangan({ tahun, dari, sampai });

  const ringkasan: LaporanKeuanganRingkasan = {
    transaksi: rekap.ringkasan.transaksi,
    lunasJumlah: rekap.ringkasan.lunasJumlah,
    lunasNominal: rekap.ringkasan.lunasNominal,
    menungguJumlah: rekap.ringkasan.menungguJumlah,
    menungguNominal: rekap.ringkasan.menungguNominal,
    belumJumlah: rekap.ringkasan.belumJumlah,
    belumNominal: rekap.ringkasan.belumNominal,
    totalNominal: rekap.ringkasan.totalNominal,
    terlambatJumlah: rekap.ringkasan.terlambatJumlah,
    terlambatNominal: rekap.ringkasan.terlambatNominal,
    penghuniAktif: rekap.penghuniAktif,
  };

  const element = createElement(LaporanKeuanganDoc, {
    labelPeriode: rekap.labelPeriode,
    dicetak: formatTanggal(new Date()),
    ringkasan,
    bulanRows: rekap.perBulan.map((b) => ({
      label: b.label,
      transaksi: b.transaksi,
      lunas: b.lunasNominal,
      belumLunas: b.belumNominal,
      menunggu: b.menungguNominal,
      total: b.totalNominal,
    })),
    metodeRows: rekap.perMetode,
    tunggakanRows: rekap.tunggakan.map((t) => ({
      nama: t.nama,
      kamarNo: t.kamarNo,
      jumlahTagihan: t.jumlahTagihan,
      nominal: t.nominal,
      jatuhTempo: formatTanggal(t.jatuhTempoTerawal),
      status: t.terlambat ? "Lewat tempo" : "Belum tempo",
    })),
  });
  // renderToBuffer meminta elemen root bertipe <Document/>; wrapper dokumen
  // aman secara runtime, sehingga dilakukan cast via unknown.
  const buffer = await renderToBuffer(
    element as unknown as Parameters<typeof renderToBuffer>[0]
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="laporan-keuangan.pdf"',
    },
  });
}
