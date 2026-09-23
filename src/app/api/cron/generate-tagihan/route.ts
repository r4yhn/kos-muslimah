import { auth } from "@/auth";
import { sinkronkanArsipPenghuni } from "@/lib/arsip";
import { sinkronTagihanSemuaPenghuni } from "@/lib/tagihan";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/generate-tagihan
 *
 * Memicu otomasi berkala (idempotent):
 * 1. auto-generate tagihan "Belum Lunas" untuk seluruh penghuni aktif;
 * 2. melengkapi **Arsip** — data lama ber-status `Keluar` yang belum punya
 *    baris di `arsip_penghuni` (mis. ditandai keluar sebelum fitur arsip ada)
 *    dipindahkan ke menu Arsip tanpa menghapus data aslinya.
 *
 * Dipanggil manual saat admin login, dan dapat dijadwalkan (mis. setiap
 * tanggal 1 dan/atau harian) lewat cron platform Vercel:
 *
 *   vercel cron "0 0 1 * *" -> https://<host>/api/cron/generate-tagihan
 *
 * Proteksi: bila variabel lingkungan CRON_SECRET diisi, header
 * `Authorization: Bearer <CRON_SECRET>` (dipakai cron Vercel) atau
 * `x-cron-secret` wajib cocok; bila tidak diisi, hanya sesi admin yang
 * boleh memicu (atau siapa saja saat development karena idempotent).
 */
export async function GET(request: Request) {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  const secret = process.env.CRON_SECRET;
  const kunciHeader = request.headers.get("x-cron-secret") ?? "";
  const kunciBearer = (request.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    ""
  );
  const kunciCocok =
    !!secret && (kunciHeader === secret || kunciBearer === secret);

  if (!isAdmin && !kunciCocok) {
    return Response.json(
      { ok: false, error: "Tidak diizinkan." },
      { status: 403 }
    );
  }

  try {
    const tagihanBaru = await sinkronTagihanSemuaPenghuni();
    const arsip = await sinkronkanArsipPenghuni();
    return Response.json({ ok: true, tagihanBaru, arsip });
  } catch (error) {
    console.error("Gagal generate tagihan:", error);
    return Response.json(
      { ok: false, error: "Gagal memproses tagihan." },
      { status: 500 }
    );
  }
}
