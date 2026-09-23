"use client";

import { useActionState, useState } from "react";
import { Check, CreditCard, Upload, Wallet } from "lucide-react";

import {
  btnPrimaryClass,
  errorBoxClass,
  fieldClass,
  helpClass,
  inputClass,
  labelClass,
  selectClass,
} from "@/lib/ui";
import { formatIDR, tanggalInputHariIni } from "@/lib/format";
import { simpanPembayaranAwal, type BayarAwalState } from "../actions";

/** Metode pembayaran online yang disediakan (disimulasikan lewat web). */
const METODE = [
  "Transfer Bank",
  "Virtual Account",
  "QRIS",
  "E-Wallet",
] as const;

const PAKET = [1, 2, 6] as const;
type Paket = (typeof PAKET)[number];

type BayarAwalFormProps = {
  noKamar: string;
  hargaSewa: number;
  periodeLabel: string;
  /** Label cakupan periode per paket (1/2/6), mis. "Sep 2026 – Feb 2027". */
  cakupanLabel: Record<number, string>;
};

/**
 * Checkout "Pembayaran Awal" — bayar online via web.
 * Penghuni memilih paket 1/2/6 bulan, total dihitung otomatis, lalu menekan
 * "Bayar Sekarang". Server langsung mencatat Lunas per bulan, membuka kunci
 * portal, dan mengirim notifikasi otomatis.
 */
export function BayarAwalForm({
  noKamar,
  hargaSewa,
  periodeLabel,
  cakupanLabel,
}: BayarAwalFormProps) {
  const [state, formAction, isPending] = useActionState<BayarAwalState, FormData>(
    simpanPembayaranAwal,
    undefined
  );
  const [paket, setPaket] = useState<Paket>(1);
  const [metode, setMetode] = useState<string>(METODE[0]);

  const total = hargaSewa * paket;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* ===== Pilihan paket 1 / 2 / 6 bulan ===== */}
      <fieldset className="flex flex-col gap-3">
        <legend className={labelClass}>
          Pilih Paket Pembayaran Awal (sewa dibayar di muka)
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PAKET.map((p) => {
            const active = paket === p;
            return (
              <label
                key={p}
                className={`relative flex cursor-pointer flex-col gap-1 rounded-md border px-4 py-3.5 transition-all duration-[100ms] ease-brand ${
                  active
                    ? "border-primary bg-primary/15 text-white shadow-card"
                    : "border-primary/20 bg-background/40 text-white/60 hover:border-primary/50 hover:text-white/80"
                }`}
              >
                <input
                  type="radio"
                  name="paket"
                  value={p}
                  checked={active}
                  onChange={() => setPaket(p)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={`absolute right-3 top-3 inline-flex size-5 items-center justify-center rounded-full border transition-colors ${
                    active
                      ? "border-primary bg-primary text-on-primary"
                      : "border-white/20"
                  }`}
                >
                  {active ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className="font-display text-lg font-bold leading-tight">
                  {p} Bulan
                </span>
                <span className="font-mono text-sm tabular-nums text-primary">
                  {formatIDR.format(hargaSewa * p)}
                </span>
                <span className="text-[11px] leading-snug text-white/45">
                  Cakupan: {cakupanLabel[p] ?? ""}
                </span>
              </label>
            );
          })}
        </div>
        <span className={helpClass}>
          Periode mulai: {periodeLabel}. Total dihitung otomatis dari harga sewa
          Kamar {noKamar} ({formatIDR.format(hargaSewa)}/bulan) dikali jumlah
          bulan paket.
        </span>
      </fieldset>

      {/* ===== Ringkasan tagihan ===== */}
      <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
        <span className={labelClass}>Total yang harus dibayar</span>
        <p className="mt-1 text-3xl font-bold tabular-nums text-white">
          {formatIDR.format(total)}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-white/50">
          {paket} bulan sewa Kamar {noKamar} — {cakupanLabel[paket] ?? periodeLabel}.
        </p>
      </div>

      {/* ===== Upload bukti bayar ===== */}
      <label className={fieldClass}>
        <span className={labelClass}>Bukti Pembayaran (foto transfer/QRIS)</span>
        <div className="relative">
          <Upload
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary/60"
          />
          <input
            type="file"
            name="bukti"
            required
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className={`${inputClass} cursor-pointer pl-10 file:mr-3 file:border-0 file:bg-transparent file:p-0 file:text-sm file:font-bold file:text-primary`}
          />
        </div>
        <span className={helpClass}>
          Lampirkan foto bukti transfer / QRIS (JPG, PNG, WebP, atau HEIC;
          maksimal 2 MB). Status pembayaran langsung berubah menjadi{" "}
          <strong className="text-white/70">Lunas</strong> dan kamar Anda aktif
          begitu form dikirim — bukti tetap tersimpan untuk pemeriksaan
          pengelola.
        </span>
      </label>

      {/* ===== Metode pembayaran online & tanggal ===== */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Metode Pembayaran Online</span>
          <div className="relative">
            <CreditCard
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary/60"
            />
            <select
              name="metodeBayar"
              value={metode}
              onChange={(e) => setMetode(e.target.value)}
              className={`${selectClass} pl-10`}
            >
              {METODE.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Tanggal Bayar</span>
          <input
            type="date"
            name="tanggalBayar"
            required
            defaultValue={tanggalInputHariIni()}
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex items-start gap-2.5 rounded-md border border-primary/20 bg-background/40 px-3.5 py-2.5 text-xs leading-relaxed text-white/50">
        <Wallet aria-hidden className="mt-0.5 size-4 shrink-0 text-primary/70" />
        <span>
          Pembayaran dikirim aman lewat web. Setelah pengelola mengonfirmasi
          bukti, sistem otomatis mengirim notifikasi, membuka seluruh menu
          portal, dan kamar resmi berstatus{" "}
          <strong className="text-white/80">Terisi</strong>.
        </span>
      </div>

      {state?.error ? (
        <div role="alert" className={errorBoxClass}>
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={btnPrimaryClass}>
          {isPending
            ? "Mengirim bukti…"
            : `Kirim Bukti & Ajukan — ${formatIDR.format(total)}`}
        </button>
      </div>
    </form>
  );
}
