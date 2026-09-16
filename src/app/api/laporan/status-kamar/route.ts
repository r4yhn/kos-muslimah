import { renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { createElement } from "react";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, penghuni } from "@/db/schema";
import { formatTanggal } from "@/lib/format";
import { LaporanStatusKamarDoc } from "@/lib/laporan";

export const dynamic = "force-dynamic";

/**
 * GET /api/laporan/status-kamar
 * Unduh PDF rekap status kamar beserta penghuninya saat ini.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role === "penghuni") {
    return new Response("Tidak diizinkan", { status: 401 });
  }

  const [daftarKamar, daftarPenghuni] = await Promise.all([
    db.select().from(kamar).orderBy(kamar.noKamar),
    db
      .select({
        idKamar: penghuni.idKamar,
        nama: penghuni.nama,
      })
      .from(penghuni)
      .where(eq(penghuni.status, "Aktif")),
  ]);

  const penghuniPerKamar = new Map<string, string[]>();
  for (const p of daftarPenghuni) {
    if (!p.idKamar) continue;
    const list = penghuniPerKamar.get(p.idKamar) ?? [];
    list.push(p.nama);
    penghuniPerKamar.set(p.idKamar, list);
  }

  const rows = daftarKamar.map((k) => ({
    noKamar: k.noKamar,
    tipeKamar: k.tipeKamar,
    hargaSewa: k.hargaSewa,
    statusKamar: k.statusKamar,
    penghuni: (penghuniPerKamar.get(k.id) ?? []).join(", "),
  }));

  const element = createElement(LaporanStatusKamarDoc, {
    rows,
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
      "Content-Disposition": 'attachment; filename="laporan-status-kamar.pdf"',
    },
  });
}
