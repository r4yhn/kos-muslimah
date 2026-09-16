import type { Metadata } from "next";
import { Bell, BellOff } from "lucide-react";
import { redirect } from "next/navigation";

import {
  btnSecondaryClass,
  cardClass,
  cellClass,
  eyebrowClass,
  headingClass,
} from "@/lib/ui";
import { daftarNotifikasi } from "@/lib/notifikasi";
import { getPortalData } from "@/lib/portal";
import { tandaiSemuaNotifikasiDibacaPortal } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifikasi",
};

const formatWaktu = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Pusat notifikasi penghuni — otomatis terisi saat ada peristiwa penting. */
export default async function PortalNotifikasiPage() {
  const data = await getPortalData();
  if (!data) redirect("/dashboard");
  if (data.terkunci) redirect("/portal/bayar-awal");

  const daftar = await daftarNotifikasi(data.userId);
  const belumDibaca = daftar.filter((n) => !n.dibaca).length;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Portal Penghuni</p>
          <h1 className={headingClass}>Notifikasi</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Informasi penting tentang akun, kamar, dan pembayaran Anda — dikirim
            otomatis oleh sistem.
          </p>
        </div>

        {belumDibaca > 0 ? (
          <form action={tandaiSemuaNotifikasiDibacaPortal}>
            <button type="submit" className={btnSecondaryClass}>
              Tandai semua sudah dibaca ({belumDibaca})
            </button>
          </form>
        ) : null}
      </div>

      <section className={`${cardClass} overflow-hidden`}>
        {daftar.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <BellOff aria-hidden className="mx-auto size-8 text-white/30" />
            <p className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
              Belum ada notifikasi.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Notifikasi akan muncul di sini secara otomatis setelah Anda
              mendaftar, membayar, atau ada pembaruan dari pengelola.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {daftar.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3.5 px-5 py-4 transition-colors duration-[100ms] ease-brand hover:bg-white/[0.03] ${
                  n.dibaca ? "opacity-75" : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border ${
                    n.dibaca
                      ? "border-white/10 bg-white/5 text-white/40"
                      : "border-primary/40 bg-primary/15 text-primary"
                  }`}
                >
                  <Bell className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-display text-base font-bold leading-snug text-white">
                      {n.judul}
                    </p>
                    {!n.dibaca ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-primary">
                        <span aria-hidden className="size-1.5 rounded-full bg-current" />
                        Baru
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    {n.pesan}
                  </p>
                </div>
                <time
                  dateTime={n.createdAt.toISOString()}
                  className={`${cellClass} shrink-0 !px-0 py-0 text-xs tabular-nums text-white/35`}
                >
                  {formatWaktu.format(n.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
