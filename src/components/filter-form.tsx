"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";

/**
 * Form filter (GET) yang nilainya **langsung dikirim** begitu salah satu
 * kontrolnya diubah, sehingga memilih "Tahun / Dari Bulan / Sampai Bulan /
 * Status" atau "Bulan" langsung mengarahkan halaman ke filter yang dituju
 * tanpa harus menekan tombol apa pun.
 *
 * Tombol "Terapkan Filter" tetap berfungsi (mengirim ulang nilai saat ini),
 * dan bila JavaScript dimatikan form tetap bekerja sebagai form GET biasa
 * karena `method`/`action` tetap dirender apa adanya.
 *
 * Catatan: beri `key` pada setiap kontrol yang nilainya berasal dari URL
 * (mis. `key={`tahun-${tahun}`}`) agar tampilan kontrol selalu sinkron setelah
 * navigasi atau Reset.
 */
export function FilterForm({
  action,
  className,
  children,
}: {
  /** Tujuan form, mis. "/laporan" atau "/pembayaran". */
  action: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  /** Kirim seluruh nilai form sebagai query string ke halaman tujuan. */
  function kirim(form: HTMLFormElement) {
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === "string") params.set(key, value);
    });
    const query = params.toString();
    startTransition(() => router.push(query ? `${action}?${query}` : action));
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      aria-busy={pending || undefined}
      className={`${className ?? ""} transition-opacity duration-[100ms] ease-brand${
        pending ? " opacity-60" : ""
      }`}
      onChange={() => {
        // Dropdown/input diubah -> langsung terapkan filternya.
        const form = formRef.current;
        if (form) kirim(form);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        kirim(event.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
