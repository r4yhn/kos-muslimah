"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CreditCard,
  ExternalLink,
  Hourglass,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { formatIDR } from "@/lib/format";
import { labelStatusMidtrans, muatSnapJs } from "@/lib/midtrans-client";
import { btnPrimaryClass, btnSecondaryClass, errorBoxClass } from "@/lib/ui";
import {
  buatTransaksiAwal,
  cekStatusTransaksiMidtrans,
} from "../midtrans-actions";

const PAKET = [1, 2, 6] as const;

/** Jeda pemantauan status pembayaran saat masih ada transaksi berjalan (ms). */
const JEDA_PANTAU_MS = 10_000;

type Props = {
  noKamar: string;
  hargaSewa: number;
  periodeLabel: string;
  cakupanLabel: Record<number, string>;
  snapClientKey: string;
  snapJsUrl: string;
  /** Transaksi Midtrans aktif (masih pending/challenge) milik penghuni ini. */
  transaksiAktif?: {
    orderId: string;
    redirectUrl: string | null;
    nominal: number;
  } | null;
};

export function MidtransCheckout({
  noKamar,
  hargaSewa,
  periodeLabel,
  cakupanLabel,
  snapClientKey,
  snapJsUrl,
  transaksiAktif,
}: Props) {
  const router = useRouter();
  const [paket, setPaket] = useState<number>(1);
  const [sibuk, setSibuk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [urlBayar, setUrlBayar] = useState<string | null>(null);
  const [orderIdBayar, setOrderIdBayar] = useState<string | null>(null);

  const total = hargaSewa * paket;

  /** Order yang sudah diproses — supaya pemantauan tidak memprosesnya dua kali. */
  const selesaiRef = useRef<Set<string>>(new Set());

  /** Tandai order sudah lunas (idempoten) & bersihkan tautan pembayaran. */
  function tandaiLunas(orderId: string): boolean {
    if (selesaiRef.current.has(orderId)) return false;
    selesaiRef.current.add(orderId);
    setUrlBayar(null);
    setOrderIdBayar(null);
    setError(null);
    setInfo("Pembayaran diterima — kamar Anda sedang diaktifkan…");
    return true;
  }

  async function periksa(orderId: string) {
    const hasil = await cekStatusTransaksiMidtrans(orderId);
    if (!hasil.ok) {
      setError(hasil.error);
      setSibuk(false);
      return;
    }
    setError(null);
    if (hasil.status === "settlement") {
      tandaiLunas(orderId);
    } else {
      setInfo(`Status pembayaran saat ini: ${labelStatusMidtrans(hasil.status)}.`);
    }
    // Muat ulang data server; bila sudah lunas halaman otomatis dialihkan.
    router.refresh();
    setSibuk(false);
  }

  // Pemantauan otomatis: selama masih ada order berjalan, status dicek berkala
  // sehingga begitu pembayaran masuk (mis. VA/QRIS dibayar di tab lain) kamar
  // aktif, tagihan, dan notifikasi langsung ter-update tanpa reload manual.
  const orderDipantau = transaksiAktif?.orderId ?? orderIdBayar ?? null;

  useEffect(() => {
    if (!orderDipantau) return;
    const orderId: string = orderDipantau;

    let aktif = true;

    async function pantau() {
      if (!aktif) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (selesaiRef.current.has(orderId)) return;
      try {
        const hasil = await cekStatusTransaksiMidtrans(orderId);
        if (!aktif) return;
        if (hasil.ok && hasil.status === "settlement") {
          if (tandaiLunas(orderId)) router.refresh();
        }
      } catch {
        // Gangguan jaringan sesaat — dicoba lagi pada interval berikutnya.
      }
    }

    void pantau();
    const timer = window.setInterval(() => void pantau(), JEDA_PANTAU_MS);
    const saatFokus = () => void pantau();
    window.addEventListener("focus", saatFokus);
    return () => {
      aktif = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", saatFokus);
    };
  }, [orderDipantau, router]);

  async function buatBayar() {
    if (hargaSewa <= 0) {
      setError("Biaya sewa kamar belum ditetapkan. Hubungi pengelola.");
      return;
    }
    setError(null);
    setInfo(null);
    setUrlBayar(null);
    setOrderIdBayar(null);
    setSibuk(true);

    const hasil = await buatTransaksiAwal(paket);
    if (!hasil.ok) {
      setError(hasil.error);
      setSibuk(false);
      return;
    }
    setUrlBayar(hasil.redirectUrl);
    setOrderIdBayar(hasil.orderId);

    try {
      await muatSnapJs(snapJsUrl, snapClientKey);
      if (!window.snap) {
        throw new Error("Snap Midtrans tidak tersedia.");
      }
      window.snap.pay(hasil.snapToken, {
        onSuccess: () => periksa(hasil.orderId),
        onPending: () => periksa(hasil.orderId),
        onClose: () => {
          setInfo(
            "Pop-up ditutup. Selesaikan pembayaran lewat tautan di bawah, lalu tekan “Cek Status Pembayaran”."
          );
          setSibuk(false);
        },
        onError: () => {
          setError(
            "Pembayaran gagal dimuat. Gunakan tautan “Buka Halaman Pembayaran” untuk melanjutkan."
          );
          setSibuk(false);
        },
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Gagal memuat pembayaran. Silakan coba lagi."
      );
      setSibuk(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-2.5 rounded-md border border-primary/20 bg-background/40 px-4 py-3 text-sm leading-relaxed text-white/60">
        <CreditCard aria-hidden className="mt-0.5 size-4 shrink-0 text-primary/70" />
        <span>
          Bayar <strong className="text-white/80">online otomatis</strong> lewat
          Midtrans (Virtual Account, QRIS, E-Wallet, Transfer Bank). Pembayaran
          diverifikasi otomatis — tanpa menunggu konfirmasi pengelola.
        </span>
      </div>

      {error ? (
        <div role="alert" className={errorBoxClass}>
          {error}
        </div>
      ) : null}

      {info ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-md border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100"
        >
          <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-sky-300" />
          <span>{info}</span>
        </div>
      ) : null}

      {transaksiAktif ? (
        <div className="flex flex-col gap-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-4 py-5">
          <p className="font-display text-lg font-bold tracking-tight text-white">
            Pembayaran sedang berjalan
          </p>
          <p className="text-sm leading-relaxed text-white/70">
            Ada transaksi sebesar{" "}
            <strong className="text-white">
              {formatIDR.format(transaksiAktif.nominal)}
            </strong>{" "}
            yang belum selesai. Lanjutkan pembayaran atau periksa statusnya.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {transaksiAktif.redirectUrl ? (
              <a
                href={transaksiAktif.redirectUrl}
                target="_blank"
                rel="noreferrer"
                className={btnPrimaryClass}
              >
                <ExternalLink className="size-4" aria-hidden />
                Buka Halaman Pembayaran
              </a>
            ) : null}
            <button
              type="button"
              disabled={sibuk}
              onClick={() => periksa(transaksiAktif.orderId)}
              className={btnSecondaryClass}
            >
              {sibuk ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )}
              Cek Status Pembayaran
            </button>
          </div>
        </div>
      ) : (
        <>
          <fieldset className="flex flex-col gap-3">
            <legend className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              Pilih Paket (sewa dibayar di muka)
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PAKET.map((p) => {
                const aktif = paket === p;
                return (
                  <label
                    key={p}
                    className={`relative flex cursor-pointer flex-col gap-1 rounded-md border px-4 py-3.5 transition-all duration-[100ms] ease-brand ${
                      aktif
                        ? "border-primary bg-primary/15 text-white shadow-card"
                        : "border-primary/20 bg-background/40 text-white/60 hover:border-primary/50 hover:text-white/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paket-midtrans"
                      value={p}
                      checked={aktif}
                      onChange={() => setPaket(p)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={`absolute right-3 top-3 inline-flex size-5 items-center justify-center rounded-full border transition-colors ${
                        aktif
                          ? "border-primary bg-primary text-on-primary"
                          : "border-white/20"
                      }`}
                    >
                      {aktif ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="font-display text-lg font-bold leading-tight">
                      {p} Bulan
                    </span>
                    <span className="font-mono text-xs text-white/50">
                      {cakupanLabel[p] ?? periodeLabel}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="rounded-md border border-primary/20 bg-background/40 px-4 py-3.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
              Total yang harus dibayar
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-white">
              {formatIDR.format(total)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              {paket} bulan sewa Kamar {noKamar} —{" "}
              {cakupanLabel[paket] ?? periodeLabel}.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={sibuk}
              onClick={buatBayar}
              className={btnPrimaryClass}
            >
              {sibuk ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Menyiapkan pembayaran…
                </>
              ) : (
                <>
                  <CreditCard className="size-4" aria-hidden />
                  Bayar Online Sekarang
                </>
              )}
            </button>
            <p className="text-xs leading-relaxed text-white/45">
              Setelah menekan tombol, halaman pembayaran aman Midtrans akan
              terbuka. Kamar resmi aktif otomatis begitu pembayaran diterima.
            </p>
          </div>

          {urlBayar && orderIdBayar ? (
            <div className="flex flex-col gap-2 rounded-md border border-primary/20 bg-background/40 px-4 py-3">
              <p className="text-xs leading-relaxed text-white/55">
                Pop-up tertutup atau gagal terbuka? Lanjutkan pembayaran di
                halaman aman Midtrans:
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={urlBayar}
                  target="_blank"
                  rel="noreferrer"
                  className={btnSecondaryClass}
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Buka Halaman Pembayaran
                </a>
                <button
                  type="button"
                  disabled={sibuk}
                  onClick={() => periksa(orderIdBayar)}
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary underline-offset-4 transition-colors duration-[100ms] ease-brand hover:underline disabled:opacity-60"
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Cek Status Pembayaran
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}


