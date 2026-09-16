import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq, type SQL } from "drizzle-orm";
import { createElement } from "react";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import { formatTanggal, namaBulan } from "@/lib/format";
import {
  LaporanPembayaranDoc,
  type LaporanPembayaranRow,
} from "@/lib/laporan";

export const dynamic = "force-dynamic";

const STATUS_VALID = ["Lunas", "Menunggu Konfirmasi", "Belum Lunas"];

function nilaiParam(
  value: string | null,
  valid: (nilai: string) => boolean
): string {
  if (!value) return "";
  const trimmed = value.trim();
  return valid(trimmed) ? trimmed : "";
}

/**
 * GET /api/laporan/pembayaran?bulan=&tahun=&status=
 * Unduh PDF riwayat pembayaran sesuai filter yang dipilih.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role === "penghuni") {
    return new Response("Tidak diizinkan", { status: 401 });
  }

  const url = new URL(request.url);
  const bulanRaw = nilaiParam(url.searchParams.get("bulan"), (v) =>
    /^\d{1,2}$/.test(v)
  );
  const tahunRaw = nilaiParam(url.searchParams.get("tahun"), (v) =>
    /^\d{4}$/.test(v)
  );
  const statusRaw = nilaiParam(url.searchParams.get("status"), (v) =>
    STATUS_VALID.includes(v)
  );

  const kondisi: SQL[] = [];
  if (bulanRaw) {
    const bulan = Number(bulanRaw);
    if (bulan >= 1 && bulan <= 12) kondisi.push(eq(pembayaran.bulan, bulan));
  }
  if (tahunRaw) kondisi.push(eq(pembayaran.tahun, Number(tahunRaw)));
  if (statusRaw) {
    kondisi.push(
      eq(pembayaran.statusBayar, statusRaw as "Lunas" | "Belum Lunas")
    );
  }

  const daftar = await db
    .select({
      id: pembayaran.id,
      tanggalBayar: pembayaran.tanggalBayar,
      bulan: pembayaran.bulan,
      tahun: pembayaran.tahun,
      jumlahBayar: pembayaran.jumlahBayar,
      metodeBayar: pembayaran.metodeBayar,
      statusBayar: pembayaran.statusBayar,
      namaPenghuni: penghuni.nama,
      kamarNo: kamar.noKamar,
    })
    .from(pembayaran)
    .innerJoin(penghuni, eq(penghuni.id, pembayaran.idPenghuni))
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .where(kondisi.length > 0 ? and(...kondisi) : undefined)
    .orderBy(pembayaran.tanggalBayar, penghuni.nama);

  const rows: LaporanPembayaranRow[] = daftar.map((r) => ({
    tanggalBayar: formatTanggal(r.tanggalBayar),
    nama: r.namaPenghuni,
    kamarNo: r.kamarNo,
    periode: `${namaBulan(r.bulan)} ${r.tahun}`,
    jumlahBayar: r.jumlahBayar,
    metodeBayar:
      r.statusBayar === "Belum Lunas" ? "—" : r.metodeBayar,
    statusBayar: r.statusBayar,
  }));

  let labelPeriode = "Semua Periode";
  if (bulanRaw && tahunRaw) {
    labelPeriode = `${namaBulan(Number(bulanRaw))} ${tahunRaw}`;
  } else if (tahunRaw) {
    labelPeriode = `Tahun ${tahunRaw}`;
  }

  const element = createElement(LaporanPembayaranDoc, {
    rows,
    labelPeriode,
    filterStatus: statusRaw,
    dicetak: formatTanggal(new Date()),
  });
  // renderToBuffer meminta elemen root bertipe <Document/>; wrapper dokumen
  // aman secara runtime, sehingga dilakukan cast via unknown.
  const buffer = await renderToBuffer(
    element as unknown as Parameters<typeof renderToBuffer>[0]
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="laporan-pembayaran.pdf"',
    },
  });
}
