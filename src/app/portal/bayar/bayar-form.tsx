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
import { simpanPembayaranBulanan, type BayarBulananState } from "./actions";

/** Metode pembayaran online yang disediakan (disimulasikan lewat web). */
const METODE = [
  "Transfer Bank",
  "Virtual Account",
  "QRIS",
  "E-Wallet",
] as const;

export type TagihanItem = {
  /** Kunci periode "tahun-bulan", mis. "2026-09" (dikirim ke server action). */
  key: string;
  /** Label periode, mis. "September 2026". */
  label: string;
};

type BayarBulananFormProps = {
  noKamar: string;
  hargaSewa: number;
  /** Tagihan belum Lunas, urut dari periode terawal. */
  tagihan: TagihanItem[];
};

/**
 * Checkout "Bayar Sewa Bulanan" — bayar tagihan sewa bulanan online via web.
 * Penghuni memilih satu/beberapa bulan tagihan, total dihitung otomatis, lalu
 * menekan "Bayar Sekarang". Server langsung mencatat Lunas per bulan terpilih,
 * mengirim notifikasi, dan mengarahkan kembali dengan status sukses.
 */
export function BayarBulananForm({
  noKamar,
  hargaSewa,
  tagihan,
}: BayarBulananFormProps) {
  const [state, formAction, isPending] = useActionState<
    BayarBulananState,
    FormData
  >(simpanPembayaranBulanan, undefined);

  // Default: tagihan terawal terpilih. Pengguna dapat menambah bulan lain.
  const [terpilih, setTerpilih] = useState<Set<string>>(
    () => new Set(tagihan.length > 0 ? [tagihan[0].key] : [])
  );
  const [metode, setMetode] = useState<string>(METODE[0]);

  const semuaTerpilih = terpilih.size === tagihan.length && tagihan.length > 0;
  const total = hargaSewa * terpilih.size;

  function toggle(key: string, checked: boolean) {
    setTerpilih((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleSemua() {
    setTerpilih(
      semuaTerpilih ? new Set() : new Set(tagihan.map((t) => t.key))
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/* ===== Pilihan bulan tagihan ===== */}
      <fieldset className="flex flex-col gap-3">
        <legend className={labelClass}>
          Pilih Bulan Tagihan yang Dibayar
        </legend>
        <div className="flex items-center justify-between gap-3">
          <span className={helpClass}>
            {tagihan.length} tagihan belum lunas — urut dari periode terawal.
            Tagihan baru muncul setiap awal bulan.
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
                    name="periode"
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
                    <span className="block text-sm font-bold leading-tight">
                      {t.label}
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

      {/* ===== Ringkasan tagihan ===== */}
      <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
        <span className={labelClass}>Total yang harus dibayar</span>
        <p className="mt-1 text-3xl font-bold tabular-nums text-white">
          {terpilih.size > 0 ? formatIDR.format(total) : "—"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-white/50">
          {terpilih.size > 0
            ? `${terpilih.size} bulan sewa Kamar ${noKamar} — ${formatIDR.format(hargaSewa)}/bulan.`
            : "Pilih minimal satu bulan tagihan untuk melanjutkan."}
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
          maksimal 2 MB). Pengelola memverifikasi bukti sebelum tagihan
          berstatus Lunas.
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
          bukti, setiap bulan yang Anda pilih berstatus{" "}
          <strong className="text-white/80">Lunas</strong> dan tampil di riwayat
          pembayaran.
        </span>
      </div>

      {state?.error ? (
        <div role="alert" className={errorBoxClass}>
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending || terpilih.size === 0}
          className={btnPrimaryClass}
        >
          {isPending
            ? "Mengirim bukti…"
            : terpilih.size > 0
              ? `Kirim Bukti & Ajukan — ${formatIDR.format(total)}`
              : "Kirim Bukti & Ajukan"}
        </button>
      </div>
    </form>
  );
}
