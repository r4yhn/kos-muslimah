import { auth } from "@/auth";
import { sinkronTagihanSemuaPenghuni } from "@/lib/tagihan";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/generate-tagihan
 *
 * Memicu auto-generate tagihan "Belum Lunas" untuk seluruh penghuni aktif
 * (idempotent). Dipanggil manual saat admin login, dan dapat dijadwalkan
 * (mis. setiap tanggal 1) lewat cron platform Vercel:
 *
 *   vercel cron "0 0 1 * *" -> https://<host>/api/cron/generate-tagihan
 *
 * Proteksi: bila variabel lingkungan CRON_SECRET diisi, header
 * `x-cron-secret` wajib cocok; bila tidak diisi, hanya sesi admin yang
 * boleh memicu (atau siapa saja saat development karena idempotent).
 */
export async function GET(request: Request) {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  const secret = process.env.CRON_SECRET;
  const key = request.headers.get("x-cron-secret") ?? "";
  if (!isAdmin && (!secret || key !== secret)) {
    return Response.json(
      { ok: false, error: "Tidak diizinkan." },
      { status: 403 }
    );
  }

  try {
    const tagihanBaru = await sinkronTagihanSemuaPenghuni();
    return Response.json({ ok: true, tagihanBaru });
  } catch (error) {
    console.error("Gagal generate tagihan:", error);
    return Response.json(
      { ok: false, error: "Gagal memproses tagihan." },
      { status: 500 }
    );
  }
}
