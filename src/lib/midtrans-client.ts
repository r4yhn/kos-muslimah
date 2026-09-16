/**
 * Helper Midtrans Snap untuk komponen client ("use client").
 *
 * File ini tidak boleh mengimpor `@/lib/midtrans` karena modul tersebut
 * menyimpan Server Key dan hanya boleh dijalankan di server. Helper di sini
 * murni berurusan dengan browser (memuat Snap.js & menerjemahkan status).
 */

declare global {
  interface Window {
    snap?: {
      pay: (snapToken: string, options: Record<string, unknown>) => void;
    };
  }
}

/**
 * Muat Snap.js Midtrans sekali (dengan data-client-key). Aman dipanggil
 * berkali-kali — script hanya ditambahkan satu kali ke <head>.
 */
export function muatSnapJs(snapJsUrl: string, clientKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.snap) {
      resolve();
      return;
    }
    if (document.getElementById("midtrans-snap-script")) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "midtrans-snap-script";
    script.src = snapJsUrl;
    script.setAttribute("data-client-key", clientKey);
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Gagal memuat pembayaran Snap Midtrans."));
    document.head.appendChild(script);
  });
}

/** Terjemahkan status internal Midtrans menjadi label yang ramah pengguna. */
export function labelStatusMidtrans(status: string): string {
  switch (status) {
    case "settlement":
      return "Lunas";
    case "pending":
      return "Menunggu pembayaran";
    case "challenge":
      return "Menunggu verifikasi";
    case "expire":
      return "Kedaluwarsa";
    case "cancel":
      return "Dibatalkan";
    case "deny":
      return "Ditolak";
    default:
      return status;
  }
}
