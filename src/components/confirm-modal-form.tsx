"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { btnDangerClass, btnSecondaryClass } from "@/lib/ui";

type ConfirmModalFormProps = {
  /** Server action yang dijalankan **hanya** setelah tombol konfirmasi ditekan. */
  action: (formData: FormData) => void | Promise<void>;
  /** Isi tombol pembuka (mis. ikon + teks) yang tampil di navbar. */
  triggerLabel: ReactNode;
  /** Kelas tombol pembuka (mengikuti gaya navbar). */
  triggerClassName?: string;
  /** Judul modal konfirmasi. */
  title: string;
  /** Kalimat pertanyaan konfirmasi. */
  message: string;
  /** Label tombol konfirmasi (aksi berbahaya / tidak dapat dibatalkan). */
  confirmLabel: string;
  /** Isian opsional di dalam modal (mis. catatan keluar). */
  children?: ReactNode;
};

/**
 * Tombol aksi berbahaya dengan **modal konfirmasi** (pop-up) di dalam halaman.
 *
 * Dipakai tombol *Selesai Sewa / Pindah Kos* pada navbar portal penghuni:
 * server action `action` **tidak** dijalankan saat penghuni menekan tombol
 * pembuka — penghuni harus menekan tombol konfirmasi di modal terlebih dahulu,
 * sehingga pengarsipan data + pengosongan kamar tidak pernah terpicu tak sengaja.
 *
 * Modal dirender lewat **portal ke `<body>`** agar tidak terkurung di dalam
 * navbar yang memakai `backdrop-blur`, dan dapat ditutup lewat tombol *Batal*,
 * ikon silang, tombol `Escape`, atau klik latar gelap; fokus otomatis diarahkan
 * ke tombol konfirmasi saat terbuka.
 */
export function ConfirmModalForm({
  action,
  triggerLabel,
  triggerClassName,
  title,
  message,
  confirmLabel,
  children,
}: ConfirmModalFormProps) {
  const [terbuka, setTerbuka] = useState(false);
  const refKonfirmasi = useRef<HTMLButtonElement>(null);

  function tutup() {
    setTerbuka(false);
  }

  // Fokuskan tombol konfirmasi + dukung penutupan lewat tombol Escape.
  useEffect(() => {
    if (!terbuka) return;

    refKonfirmasi.current?.focus();

    function saatTombolDitekan(event: KeyboardEvent) {
      if (event.key === "Escape") setTerbuka(false);
    }

    window.addEventListener("keydown", saatTombolDitekan);
    return () => window.removeEventListener("keydown", saatTombolDitekan);
  }, [terbuka]);

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Latar gelap — klik di luar modal untuk membatalkan. */}
      <button
        type="button"
        aria-label="Batalkan dan tutup konfirmasi"
        onClick={tutup}
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90vh] w-full max-w-md animate-rise overflow-y-auto rounded-xl border border-red-400/30 bg-surface p-6 shadow-elevated"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-bold leading-tight tracking-tight text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={tutup}
            aria-label="Tutup konfirmasi"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-white/15 text-white/60 transition-colors duration-[100ms] ease-brand hover:border-white/30 hover:bg-white/5 hover:text-white"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-white/70">{message}</p>

        <form action={action} className="mt-5 flex flex-col gap-4">
          {children}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={tutup} className={btnSecondaryClass}>
              Batal
            </button>
            <button
              ref={refKonfirmasi}
              type="submit"
              className={btnDangerClass}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {/*
        Portal ke `<body>`: navbar portal memakai `backdrop-blur`, sedangkan
        `backdrop-filter` menjadikan elemen induk sebagai containing block untuk
        `position: fixed` — tanpa portal, modal berisiko terkurung di header.
        State `terbuka` hanya bisa menjadi true setelah klik di sisi klien,
        sehingga `document` selalu tersedia (dan tidak diakses saat SSR).
      */}
      {terbuka ? createPortal(modal, document.body) : null}
    </>
  );
}
