import { and, count, eq, sum } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import {
  daftarTagihanTerlambatPerPenghuni,
  sinkronTagihanSemuaPenghuni,
} from "@/lib/tagihan";

export const dynamic = "force-dynamic";

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const formatIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/* ============================================================
 * Badge status — DESIGN.MD: warna tidak boleh jadi satu-satunya
 * indikator, maka selalu disertai dot & label teks.
 * ============================================================ */
const badgeBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium leading-none";

function StatusDot() {
  return (
    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
  );
}

function kamarBadgeClass(status: string) {
  switch (status) {
    case "Tersedia":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "Terisi":
      return "border-sky-400/30 bg-sky-400/10 text-sky-300";
    case "Perbaikan":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    default:
      return "border-white/15 bg-white/5 text-white/60";
  }
}

function bayarBadgeClass(status: string) {
  switch (status) {
    case "Lunas":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "Menunggu Konfirmasi":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    default:
      return "border-red-400/40 bg-red-400/10 text-red-300";
  }
}

async function getDashboardData() {
  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();

  // Terbitkan tagihan bulan berjalan yang belum ada (idempotent) supaya angka
  // "Belum Lunas" & "lewat jatuh tempo" selalu akurat saat dashboard dibuka.
  await sinkronTagihanSemuaPenghuni();

  // --- Statistik kamar ---
  const kamarCounts = await db
    .select({ status: kamar.statusKamar, total: count() })
    .from(kamar)
    .groupBy(kamar.statusKamar);

  const totalKamar = kamarCounts.reduce((acc, r) => acc + r.total, 0);
  const kamarTerisi =
    kamarCounts.find((r) => r.status === "Terisi")?.total ?? 0;
  const kamarTersedia =
    kamarCounts.find((r) => r.status === "Tersedia")?.total ?? 0;
  const kamarPerbaikan =
    kamarCounts.find((r) => r.status === "Perbaikan")?.total ?? 0;

  // --- Penghuni ---
  const [aktifRow] = await db
    .select({ total: count() })
    .from(penghuni)
    .where(eq(penghuni.status, "Aktif"));
  const [semuaRow] = await db.select({ total: count() }).from(penghuni);

  const penghuniAktif = aktifRow?.total ?? 0;
  const penghuniTotal = semuaRow?.total ?? 0;

  // --- Pembayaran bulan berjalan ---
  const bayarRows = await db
    .select({
      status: pembayaran.statusBayar,
      jumlah: count(),
      nominal: sum(pembayaran.jumlahBayar),
    })
    .from(pembayaran)
    .where(and(eq(pembayaran.bulan, bulan), eq(pembayaran.tahun, tahun)))
    .groupBy(pembayaran.statusBayar);

  const lunas = bayarRows.find((r) => r.status === "Lunas");
  const belumLunas = bayarRows.find((r) => r.status === "Belum Lunas");
  const lunasCount = lunas?.jumlah ?? 0;
  const lunasNominal = Number(lunas?.nominal ?? 0);
  const belumLunasCount = belumLunas?.jumlah ?? 0;
  const belumLunasNominal = Number(belumLunas?.nominal ?? 0);

  // --- Quick alert: penghuni aktif tanpa pembayaran Lunas bulan berjalan ---
  const aktifPenghuniRows = await db
    .select({
      id: penghuni.id,
      nama: penghuni.nama,
      tglMasuk: penghuni.tglMasuk,
      kamarNo: kamar.noKamar,
      hargaSewa: kamar.hargaSewa,
    })
    .from(penghuni)
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .where(eq(penghuni.status, "Aktif"))
    .orderBy(penghuni.nama);

  const lunasPenghuniRows = await db
    .select({ idPenghuni: pembayaran.idPenghuni })
    .from(pembayaran)
    .where(
      and(
        eq(pembayaran.bulan, bulan),
        eq(pembayaran.tahun, tahun),
        eq(pembayaran.statusBayar, "Lunas")
      )
    );

  const lunasSet = new Set(lunasPenghuniRows.map((r) => r.idPenghuni));

  // Penghuni yang bulan ini sudah mengirim bukti (Menunggu Konfirmasi).
  const menungguPenghuniRows = await db
    .select({ idPenghuni: pembayaran.idPenghuni })
    .from(pembayaran)
    .where(
      and(
        eq(pembayaran.bulan, bulan),
        eq(pembayaran.tahun, tahun),
        eq(pembayaran.statusBayar, "Menunggu Konfirmasi")
      )
    );
  const menungguSet = new Set(menungguPenghuniRows.map((r) => r.idPenghuni));

  // Tagihan yang sudah lewat jatuh tempo (bisa berasal dari periode sebelum
  // bulan berjalan) -> ditampilkan per penghuni & diagregasi di kartu.
  const terlambatMap = await daftarTagihanTerlambatPerPenghuni();
  let terlambatJumlahTagihan = 0;
  let terlambatNominal = 0;
  for (const entry of terlambatMap.values()) {
    terlambatJumlahTagihan += entry.jumlahTagihan;
    terlambatNominal += entry.totalNominal;
  }

  const alerts = aktifPenghuniRows
    .filter((r) => !lunasSet.has(r.id))
    .map((r) => ({
      ...r,
      menungguKonfirmasi: menungguSet.has(r.id),
      terlambat: terlambatMap.get(r.id) ?? null,
    }));

  return {
    bulan,
    tahun,
    totalKamar,
    kamarTerisi,
    kamarTersedia,
    kamarPerbaikan,
    penghuniAktif,
    penghuniTotal,
    lunasCount,
    lunasNominal,
    belumLunasCount,
    belumLunasNominal,
    terlambatJumlahTagihan,
    terlambatNominal,
    alerts,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const d = await getDashboardData();
  const name = session.user.name ?? "Admin";
  const bulanLabel = `${NAMA_BULAN[d.bulan - 1]} ${d.tahun}`;
  const penghuniRatio =
    d.penghuniTotal > 0
      ? Math.round((d.penghuniAktif / d.penghuniTotal) * 100)
      : 0;

  const cardClass = "rounded-xl border border-primary/20 bg-surface shadow-card";
  const hoverCardClass =
    "transition-[border-color,box-shadow,transform] duration-[400ms] ease-brand hover:-translate-y-0.5 hover:border-primary/50";

  return (
    <div className="flex w-full flex-col gap-6">
        {/* Sapaan */}
        <section className="animate-rise">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-primary/80">
            Ringkasan · {bulanLabel}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl">
            Selamat datang, {name}
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Pantau kondisi kamar, penghuni aktif, dan pembayaran sewa pada
            periode{" "}
            <span className="font-mono text-primary">{bulanLabel}</span>.
          </p>
        </section>

        {/* ====== Statistik Cepat ====== */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Total Kamar */}
          <article
            className={`${cardClass} ${hoverCardClass} animate-rise p-5`}
            style={{ animationDelay: "80ms" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary/80">
                Total Kamar
              </h2>
              <span className="font-mono text-[10px] text-white/30">01</span>
            </div>
            <p className="mt-3 text-4xl font-bold leading-none tabular-nums text-white">
              {d.totalKamar}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className={`${badgeBase} ${kamarBadgeClass("Tersedia")}`}>
                <StatusDot />
                <span>Tersedia</span>
                <span className="tabular-nums">{d.kamarTersedia}</span>
              </span>
              <span className={`${badgeBase} ${kamarBadgeClass("Terisi")}`}>
                <StatusDot />
                <span>Terisi</span>
                <span className="tabular-nums">{d.kamarTerisi}</span>
              </span>
              <span className={`${badgeBase} ${kamarBadgeClass("Perbaikan")}`}>
                <StatusDot />
                <span>Perbaikan</span>
                <span className="tabular-nums">{d.kamarPerbaikan}</span>
              </span>
            </div>
          </article>

          {/* Penghuni Aktif */}
          <article
            className={`${cardClass} ${hoverCardClass} animate-rise p-5`}
            style={{ animationDelay: "160ms" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary/80">
                Penghuni Aktif
              </h2>
              <span className="font-mono text-[10px] text-white/30">02</span>
            </div>
            <p className="mt-3 text-4xl font-bold leading-none tabular-nums text-white">
              {d.penghuniAktif}
            </p>
            <div className="mt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-[2000ms] ease-brand"
                  style={{ width: `${penghuniRatio}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-white/50">
                {penghuniRatio}% dari {d.penghuniTotal} penghuni terdaftar
              </p>
            </div>
          </article>

          {/* Pembayaran Bulan Ini */}
          <article
            className={`${cardClass} ${hoverCardClass} animate-rise p-5`}
            style={{ animationDelay: "240ms" }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary/80">
                Pembayaran
              </h2>
              <span className="font-mono text-[10px] uppercase text-white/30">
                {bulanLabel}
              </span>
            </div>
            <div className="mt-5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <span className={`${badgeBase} ${bayarBadgeClass("Lunas")}`}>
                  <StatusDot />
                  Lunas
                </span>
                <span className="font-mono text-xs leading-none tabular-nums text-white/60">
                  {d.lunasCount}× ·{" "}
                  <span className="font-bold text-white">
                    {formatIDR.format(d.lunasNominal)}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-red-400/15 bg-red-400/[0.04] px-3 py-2.5">
                <span className={`${badgeBase} ${bayarBadgeClass("Belum Lunas")}`}>
                  <StatusDot />
                  Belum Lunas
                </span>
                <span className="font-mono text-xs leading-none tabular-nums text-red-200/80">
                  {d.belumLunasCount}× ·{" "}
                  <span className="font-bold text-red-200">
                    {formatIDR.format(d.belumLunasNominal)}
                  </span>
                </span>
              </div>
              {d.terlambatJumlahTagihan > 0 ? (
                <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 font-mono text-[11px] leading-relaxed text-red-200">
                  ⚠ {d.terlambatJumlahTagihan} tagihan lewat jatuh tempo ·{" "}
                  {formatIDR.format(d.terlambatNominal)}
                </p>
              ) : null}
              <Link
                href={`/laporan?tahun=${d.tahun}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 self-start font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-primary/80 transition-colors duration-[100ms] ease-brand hover:text-primary"
              >
                Laporan Keuangan
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </article>
        </section>

        {/* ====== Quick Alert: Belum Lunas ====== */}
        <section
          className="animate-rise overflow-hidden rounded-xl border border-red-400/20 bg-surface shadow-card"
          style={{ animationDelay: "320ms" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[6px] bg-red-400/10 text-red-300">
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                  className="size-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-bold leading-tight text-white">
                  Penghuni Belum Lunas
                </h2>
                <p className="mt-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
                  Periode {bulanLabel}
                </p>
              </div>
            </div>
            <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2.5 py-1 font-mono text-[11px] font-medium text-red-300">
              {d.alerts.length} penghuni
            </span>
          </div>

          {d.alerts.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="font-display text-2xl font-bold tracking-tight text-white">
                Semua sudah lunas.
              </p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-white/40">
                Tidak ada tagihan belum lunas untuk {bulanLabel}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
                      #
                    </th>
                    <th className="px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
                      Penghuni
                    </th>
                    <th className="px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
                      Kamar
                    </th>
                    <th className="hidden px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60 md:table-cell">
                      Masuk Sejak
                    </th>
                    <th className="hidden px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60 md:table-cell">
                      Tagihan / Bulan
                    </th>
                    <th className="px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {d.alerts.map((p, i) => (
                    <tr
                      key={p.id}
                      className="bg-red-400/[0.04] transition-colors duration-[100ms] ease-brand hover:bg-red-400/[0.09]"
                    >
                      <td className="px-5 py-3 font-mono text-xs leading-relaxed tabular-nums text-white/40">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-5 py-3 font-bold leading-relaxed text-white">
                        {p.nama}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs leading-relaxed text-white/60">
                        {p.kamarNo ?? "Tanpa Kamar"}
                      </td>
                      <td className="hidden px-5 py-3 leading-relaxed text-white/60 md:table-cell">
                        {p.tglMasuk.toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="hidden px-5 py-3 font-mono text-xs leading-relaxed tabular-nums text-white/60 md:table-cell">
                        {p.hargaSewa ? formatIDR.format(p.hargaSewa) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`${badgeBase} ${
                            p.menungguKonfirmasi
                              ? bayarBadgeClass("Menunggu Konfirmasi")
                              : bayarBadgeClass("Belum Lunas")
                          }`}
                        >
                          <StatusDot />
                          {p.menungguKonfirmasi
                            ? "Menunggu Konfirmasi"
                            : "Belum Lunas"}
                        </span>
                        {p.terlambat ? (
                          <span className="mt-1.5 block font-mono text-[10px] leading-tight text-red-300">
                            Lewat jatuh tempo · {p.terlambat.jumlahTagihan}{" "}
                            tagihan
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
  );
}




