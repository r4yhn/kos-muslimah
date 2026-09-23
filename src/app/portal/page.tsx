import type { Metadata } from "next";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  CreditCard,
  DoorOpen,
  MessageSquareWarning,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { KamarBadge, PenghuniBadge } from "@/components/badges";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  cardClass,
  eyebrowClass,
  headingClass,
  labelClass,
} from "@/lib/ui";
import { formatIDR, formatTanggal } from "@/lib/format";
import { getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beranda",
};

export default async function PortalBerandaPage({
  searchParams,
}: {
  searchParams: Promise<{ selesai?: string | string[]; paket?: string | string[] }>;
}) {
  const data = await getPortalData();
  if (!data) redirect("/dashboard");
  if (data.terkunci) redirect("/portal/bayar-awal");

  const sp = await searchParams;
  const selesai = typeof sp.selesai === "string" && sp.selesai === "1";
  const paket = typeof sp.paket === "string" ? sp.paket : "";

  const cards = [
    {
      label: "Kamar",
      nilai: data.noKamar ?? "—",
      ikon: DoorOpen,
    },
    {
      label: "Biaya Sewa / Bulan",
      nilai: data.hargaSewa ? formatIDR.format(data.hargaSewa) : "—",
      ikon: ReceiptText,
    },
    {
      label: "Masuk Sejak",
      nilai: formatTanggal(data.tglMasuk),
      ikon: CheckCircle2,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      {selesai ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
        >
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          <span>
            <strong className="font-bold">Pembayaran Awal berhasil.</strong>{" "}
            {paket ? `Paket ${paket} bulan telah dicatat Lunas. ` : ""}
            Status kamar Anda kini aktif dan seluruh menu portal sudah terbuka.
          </span>
        </div>
      ) : null}

      <div>
        <p className={eyebrowClass}>Portal Penghuni</p>
        <h1 className={headingClass}>Assalamu&apos;alaikum, {data.nama} 👋</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Pantau status kamar, bayar tagihan sewa bulanan, dan lihat riwayat
          pembayaran Anda di Kos Pondok Muslimah.
        </p>
      </div>

      <section className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
          Status keanggotaan:
          <PenghuniBadge status={data.status} />
        </span>
        {data.noKamar && data.statusKamar ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
            Status kamar:
            <KamarBadge status={data.statusKamar} />
          </span>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className="animate-rise rounded-xl border border-primary/20 bg-surface p-5 shadow-card"
          >
            <card.ikon aria-hidden className="size-4 text-primary/70" />
            <p className={`${labelClass} mt-4`}>{card.label}</p>
            <p className="mt-1.5 text-xl font-bold leading-snug text-white">
              {card.nilai}
            </p>
          </article>
        ))}
      </section>

      <section className={`${cardClass} p-6`}>
        <h2 className="font-display text-xl font-bold tracking-tight text-white">
          Menu Penghuni
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
          Bayar tagihan sewa bulanan secara <em>online</em>, lihat riwayat
          pembayaran, baca notifikasi akun, atau laporkan kendala kamar Anda.
          Jika ada kendala tagihan, silakan hubungi pengelola kos.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/portal/bayar" className={btnPrimaryClass}>
            <CreditCard className="size-4" aria-hidden />
            Bayar Sewa Bulanan
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/portal/riwayat" className={btnSecondaryClass}>
            <ReceiptText className="size-4" aria-hidden />
            Riwayat Pembayaran
          </Link>
          <Link href="/portal/notifikasi" className={btnSecondaryClass}>
            <Bell className="size-4" aria-hidden />
            Notifikasi
          </Link>
          <Link href="/portal/pengaduan" className={btnSecondaryClass}>
            <MessageSquareWarning className="size-4" aria-hidden />
            Pengaduan
          </Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-white/45">
          Tombol <strong className="text-white/70">Keluar</strong> pada navbar
          hanya mengakhiri sesi login Anda — data keanggotaan tetap utuh dan
          kamar tidak berubah. Bila Anda benar-benar berhenti menghuni kos
          (selesai sewa / pindah kos), gunakan tombol{" "}
          <strong className="text-white/70">Selesai Sewa / Pindah Kos</strong>{" "}
          pada navbar, lengkapi catatan bila perlu, lalu setujui konfirmasi yang
          muncul.
        </p>
      </section>
    </div>
  );
}
