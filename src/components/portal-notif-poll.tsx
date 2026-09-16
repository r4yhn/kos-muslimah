"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { jumlahNotifikasiPortalBelumDibaca } from "@/app/portal/actions";

/** Jeda pemeriksaan notifikasi baru (ms). */
const JEDA_PERIKSA_MS = 15_000;

type Props = {
  /** Jumlah notifikasi belum dibaca yang sedang tampil di lonceng. */
  belumDibaca: number;
};

/**
 * Penyegar notifikasi portal penghuni secara "real-time": jumlah notifikasi
 * belum dibaca diperiksa berkala (dan saat tab kembali aktif), lalu halaman
 * disegarkan begitu ada notifikasi baru — misalnya saat pembayaran online
 * Midtrans baru masuk / baru lunas, tanpa perlu reload manual.
 */
export function PortalNotifPoll({ belumDibaca }: Props) {
  const router = useRouter();

  useEffect(() => {
    let aktif = true;

    async function periksa() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        const jumlah = await jumlahNotifikasiPortalBelumDibaca();
        if (aktif && jumlah !== belumDibaca) router.refresh();
      } catch {
        // Gangguan jaringan/sesi — dicoba lagi pada interval berikutnya.
      }
    }

    const saatFokus = () => void periksa();
    const timer = window.setInterval(() => void periksa(), JEDA_PERIKSA_MS);
    window.addEventListener("focus", saatFokus);
    return () => {
      aktif = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", saatFokus);
    };
  }, [belumDibaca, router]);

  return null;
}
