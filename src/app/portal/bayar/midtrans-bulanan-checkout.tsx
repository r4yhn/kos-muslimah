"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  btnPrimaryClass,
  btnSecondaryClass,
  errorBoxClass,
  helpClass,
  labelClass,
} from "@/lib/ui";
import {
  buatTransaksiBulanan,
  cekStatusTransaksiMidtrans,
} from "../midtrans-actions";

/** Opsi paket bulan yang dapat dibayar sekaligus (sama seperti Pembayaran Awal). */
const PAKET = [1, 2, 6] as const;

/** Jeda pemantauan status pembayaran saat masih ada transaksi berjalan (ms). */
const JEDA_PANTAU_MS = 10_000;

export type PeriodeOnline = {
  /** Kunci periode "tahun-bulan", mis. "2026-09" (dikirim ke server action). */
  key: string;
  /** Label periode, mis. "September 2026". */
  label: string;
  /** true = bulan yang belum jatuh tempo (dibayar di muka). */
  masaDepan: boolean;
};

type Props = {
  noKamar: string;
  hargaSewa: number;
  /** Periode yang boleh dibayar online, urut dari tagihan terawal. */
  tagihan: PeriodeOnline[];
  snapClientKey: string;
  snapJsUrl: string;
  /** Transaksi Midtrans bulanan aktif (pending/challenge) milik penghuni ini. */
  transaksiAktif?: {
    orderId: string;
    redirectUrl: string | null;
    nominal: number;
  } | null;
};

/**
 * Checkout "Bayar Sewa Bulanan" online otomatis lewat Midtrans Snap — dipakai
 * penghuni aktif (Pembayaran Awal sudah tuntas, seluruh menu portal terbuka).
 *
 * Tersedia opsi **paket 1/2/6 bulan** seperti Pembayaran Awal (boleh dibayar di
 * muka) atau centang bulan tertentu. Begitu Midtrans melaporkan `settlement`,
 * setiap bulan terpilih otomatis tercatat Lunas tanpa verifikasi pengelola,
 * notifikasi muncul, dan halaman disegarkan otomatis (dipantau berkala).
 */
export function MidtransBulananCheckout({
  noKamar,
  hargaSewa,
  tagihan,
  snapClientKey,
  snapJsUrl,
  transaksiAktif,
}: Props) {
  const router = useRouter();

  const [pilihan, setPilihan] = useState<Set<string>>(
    () => new Set(tagihan.length > 0 ? [tagihan[0].key] : [])
  );
  const [sibuk, setSibuk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [urlBayar, setUrlBayar] = useState<string | null>(null);
  const [orderIdBayar, setOrderIdBayar] = useState<string | null>(null);

  /** Order yang sudah diproses — supaya pemantauan tidak memprosesnya dua kali. */
  const selesaiRef = useRef<Set<string>>(new Set());

  // Pilihan efektif = pilihan pengguna ∩ periode yang masih bisa dibayar.
  // Dihitung langsung (bukan disinkronkan lewat effect) sehingga pilihan lama
  // otomatis gugur begitu daftar periode menyusut setelah pembayaran lunas.
  const kunciValid = new Set(tagihan.map((t) => t.key));
  const terpilih = new Set([...pilihan].filter((k) => kunciValid.has(k)));

  const semuaTerpilih = terpilih.size === tagihan.length && tagihan.length > 0;
  const total = hargaSewa * terpilih.size;

  // Paket 1/2/6 bulan, dibatasi jumlah periode yang tersedia.
  const paketTersedia = useMemo(
    () => PAKET.filter((p) => p <= tagihan.length),
    [tagihan.length]
  );
  const paketAktif = paketTersedia.find(
    (p) =>
      terpilih.size === p &&
      tagihan.slice(0, p).every((t) => terpilih.has(t.key))
  );
  const jumlahMasaDepan = tagihan.filter(
    (t) => t.masaDepan && terpilih.has(t.key)
  ).length;

  function toggle(key: string, checked: boolean) {
    setPilihan((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleSemua() {
    setPilihan(semuaTerpilih ? new Set() : new Set(tagihan.map((t) => t.key)));
  }

  function pilihPaket(p: number) {
    setPilihan(new Set(tagihan.slice(0, p).map((t) => t.key)));
  }

  /** Tandai satu order sudah lunas (idempoten) & bersihkan tautan pembayaran. */
  function tandaiLunas(orderId: string): boolean {
    if (selesaiRef.current.has(orderId)) return false;
    selesaiRef.current.add(orderId);
    setUrlBayar(null);
    setOrderIdBayar(null);
    setError(null);
    setInfo(
      "Pembayaran diterima — tagihan sewa bulanan Anda otomatis tercatat Lunas…"
    );
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
    // Muat ulang data server; periode yang sudah lunas hilang dari daftar.
    router.refresh();
    setSibuk(false);
  }

  // Pemantauan otomatis: selama masih ada order berjalan, status dicek berkala
  // sehingga begitu pembayaran masuk (mis. VA/QRIS dibayar di tab lain) tagihan,
  // status kamar, dan notifikasi langsung ter-update tanpa reload manual.
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
    if (terpilih.size === 0) {
      setError("Pilih minimal satu bulan tagihan untuk melanjutkan.");
      return;
    }

    setError(null);
    setInfo(null);
    setUrlBayar(null);
    setOrderIdBayar(null);
    setSibuk(true);

    const hasil = await buatTransaksiBulanan([...terpilih]);
    if (!hasil.ok) {
      setError(hasil.error);
      setSibuk(false);
      return;
    }
    setUrlBayar(hasil.redirectUrl);
    setOrderIdBayar(hasil.orderId);
    router.refresh();

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
            "Pop-up ditutup. Selesaikan pembayaran lewat tautan di bawah, lalu tekan “Cek Status Pembayaran” — status juga diperbarui otomatis begitu pembayaran masuk."
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
          Midtrans (Virtual Account, QRIS, E-Wallet, Transfer Bank). Tersedia
          paket <strong className="text-white/80">1, 2, atau 6 bulan</strong>{" "}
          seperti Pembayaran Awal — pembayaran diverifikasi otomatis tanpa
          menunggu konfirmasi pengelola.
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
          aria-live="polite"
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
            yang belum selesai. Lanjutkan pembayaran atau periksa statusnya —
            halaman ini juga diperbarui otomatis begitu pembayaran diterima.
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
          {paketTersedia.length > 0 ? (
            <fieldset className="flex flex-col gap-3">
              <legend className={labelClass}>Pilih Paket Pembayaran</legend>
              <p className={helpClass}>
                Paket menghitung bulan <strong>berurutan</strong> mulai dari
                tagihan terawal. Paket 2/6 bulan otomatis melanjutkan ke bulan
                berikutnya — termasuk bulan yang belum jatuh tempo (bayar di
                muka).
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {paketTersedia.map((p) => {
                  const aktif = paketAktif === p;
                  const periodePaket = tagihan.slice(0, p);
                  const awal = periodePaket[0];
                  const akhir = periodePaket[periodePaket.length - 1];
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={aktif}
                      onClick={() => pilihPaket(p)}
                      className={`flex flex-col gap-1 rounded-md border px-4 py-3.5 text-left transition-all duration-[100ms] ease-brand ${
                        aktif
                          ? "border-primary bg-primary/15 text-white shadow-card"
                          : "border-primary/20 bg-background/40 text-white/60 hover:border-primary/50 hover:text-white/80"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-display text-lg font-bold leading-tight">
                          {p} Bulan
                        </span>
                        {aktif ? (
                          <Check className="size-4 text-primary" strokeWidth={3} />
                        ) : null}
                      </span>
                      <span className="font-mono text-xs leading-snug text-white/50">
                        {awal?.label}
                        {p > 1 && akhir ? ` – ${akhir.label}` : ""}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-primary">
                        {formatIDR.format(hargaSewa * p)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="flex flex-col gap-3">
            <legend className={labelClass}>Rincian Bulan yang Dibayar</legend>
            <div className="flex items-center justify-between gap-3">
              <span className={helpClass}>
                {tagihan.length} bulan tersedia untuk dibayar online — urut dari
                periode terawal.
              </span>
              <button
                type="button"
                onClick={toggleSemua}
                className="inline-flex min-h-[44px] items-center justify-center rounded-md px-3 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-primary transition-all duration-[100ms] ease-brand hover:bg-primary/10 active:translate-y-px"
              >
                {semuaTerpilih ? "Kosongkan" : "Pilih semua"}
              </button>
            </div>

            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {tagihan.map((t) => {
                const active = terpilih.has(t.key);
                return (
                  <li key={t.key}>
                    <label
                      className={`relative flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-all duration-[100ms] ease-brand ${
                        active
                          ? "border-primary bg-primary/15 text-white shadow-card"
                          : "border-primary/20 bg-background/40 text-white/60 hover:border-primary/50 hover:text-white/80"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="periode-midtrans"
                        value={t.key}
                        checked={active}
                        onChange={(e) => toggle(t.key, e.target.checked)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          active
                            ? "border-primary bg-primary text-on-primary"
                            : "border-white/25"
                        }`}
                      >
                        {active ? <Check className="size-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="block text-sm font-bold leading-tight">
                            {t.label}
                          </span>
                          {t.masaDepan ? (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-sky-200">
                              di muka
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block font-mono text-xs tabular-nums text-primary">
                          {formatIDR.format(hargaSewa)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
            <span className={labelClass}>Total yang harus dibayar</span>
            <p className="mt-1 text-3xl font-bold tabular-nums text-white">
              {terpilih.size > 0 ? formatIDR.format(total) : "—"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              {terpilih.size > 0
                ? `${terpilih.size} bulan sewa Kamar ${noKamar} — ${formatIDR.format(
                    hargaSewa
                  )}/bulan${
                    jumlahMasaDepan > 0 ? ` (${jumlahMasaDepan} bulan di muka)` : ""
                  }.`
                : "Pilih minimal satu bulan tagihan untuk melanjutkan."}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={sibuk || terpilih.size === 0}
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
              terbuka. Bulan yang dipilih otomatis berstatus{" "}
              <strong className="text-white/70">Lunas</strong> begitu pembayaran
              diterima — status, kamar, dan notifikasi ikut diperbarui.
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
