/**
 * Badge status untuk kamar / penghuni / pembayaran.
 * DESIGN.MD: warna tidak boleh menjadi satu-satunya indikator,
 * maka selalu disertai dot & label teks.
 */

const badgeBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium leading-none";

export function StatusDot() {
  return <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />;
}

function kamarBadgeClass(status: string): string {
  switch (status) {
    case "Tersedia":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "Terisi":
      return "border-sky-400/30 bg-sky-400/10 text-sky-300";
    case "Perbaikan":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    default:
      return "border-white/15 bg-white/5 text-white/60";
  }
}

function penghuniBadgeClass(status: string): string {
  switch (status) {
    case "Aktif":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "Keluar":
      return "border-white/15 bg-white/5 text-white/55";
    default:
      return "border-white/15 bg-white/5 text-white/60";
  }
}

function bayarBadgeClass(status: string): string {
  switch (status) {
    case "Lunas":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "Menunggu Konfirmasi":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    default:
      return "border-red-400/40 bg-red-400/10 text-red-300";
  }
}

function pengaduanBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "diproses":
      return "border-sky-400/30 bg-sky-400/10 text-sky-300";
    case "selesai":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    default:
      return "border-white/15 bg-white/5 text-white/60";
  }
}

function alasanArsipBadgeClass(alasan: string): string {
  switch (alasan) {
    case "Proses Keluar":
      return "border-sky-400/30 bg-sky-400/10 text-sky-300";
    case "Habis Masa Sewa":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    default:
      return "border-white/15 bg-white/5 text-white/60";
  }
}

export function KamarBadge({ status }: { status: string }) {
  return (
    <span className={`${badgeBase} ${kamarBadgeClass(status)}`}>
      <StatusDot />
      {status}
    </span>
  );
}

export function PenghuniBadge({ status }: { status: string }) {
  return (
    <span className={`${badgeBase} ${penghuniBadgeClass(status)}`}>
      <StatusDot />
      {status}
    </span>
  );
}

export function BayarBadge({ status }: { status: string }) {
  return (
    <span className={`${badgeBase} ${bayarBadgeClass(status)}`}>
      <StatusDot />
      {status}
    </span>
  );
}

/**
 * Badge status pengaduan: `pending` / `diproses` / `selesai`.
 * `label` dipakai untuk menampilkan huruf awal kapital (mis. "Diproses").
 */
export function PengaduanBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <span className={`${badgeBase} ${pengaduanBadgeClass(status)}`}>
      <StatusDot />
      {label ?? status}
    </span>
  );
}

/**
 * Badge alasan pengarsipan penghuni: `Proses Keluar` / `Habis Masa Sewa`.
 * Dipakai pada menu Arsip (panel admin) & portal penghuni.
 */
export function AlasanArsipBadge({ alasan }: { alasan: string }) {
  return (
    <span className={`${badgeBase} ${alasanArsipBadgeClass(alasan)}`}>
      <StatusDot />
      {alasan}
    </span>
  );
}
