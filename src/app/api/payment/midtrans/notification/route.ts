import { normalisasiStatusMidtrans, verifikasiSignatureMidtrans } from "@/lib/midtrans";
import {
  perbaruiStatusTransaksi,
  terapkanSettlementTransaksi,
} from "@/lib/payment-online";

export const dynamic = "force-dynamic";

/**
 * POST /api/payment/midtrans/notification
 *
 * Webhook HTTP notification dari Midtrans. Midtrans memanggil URL ini setiap
 * ada perubahan status transaksi (pending / settlement / expire / dll).
 * Signature diverifikasi (SHA512 order_id+status_code+gross_amount+ServerKey)
 * sebelum status pembayaran diubah. Saat `settlement`, baris `pembayaran`
 * langsung dicatat Lunas & kunci "Bayar di Awal" dibuka otomatis.
 *
 * Route ini TIDAK lewat auth proxy (lihat matcher `src/proxy.ts`).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Body bukan JSON." }, { status: 400 });
  }

  const orderId = String(body.order_id ?? "");
  const statusCode = String(body.status_code ?? "");
  const grossAmount = String(body.gross_amount ?? "");
  const signatureKey = String(body.signature_key ?? "");
  const transactionStatus = String(body.transaction_status ?? "");
  const paymentType = String(body.payment_type ?? "");

  if (!orderId || !transactionStatus) {
    return Response.json({ ok: false, error: "Data tidak lengkap." }, { status: 400 });
  }

  const signatureValid = verifikasiSignatureMidtrans({
    orderId,
    statusCode,
    grossAmount,
    signatureKey,
  });
  if (!signatureValid) {
    return Response.json({ ok: false, error: "Signature tidak valid." }, { status: 403 });
  }

  const status = normalisasiStatusMidtrans({
    transaction_status: transactionStatus,
    fraud_status: String(body.fraud_status ?? ""),
  });

  try {
    if (status === "settlement") {
      const hasil = await terapkanSettlementTransaksi(orderId, paymentType || undefined);
      return Response.json({
        ok: true,
        diterapkan: hasil === "applied",
      });
    }

    const hasil = await perbaruiStatusTransaksi(orderId, status, paymentType || undefined);
    if (hasil === "notfound") {
      return Response.json({ ok: false, error: "Order tidak ditemukan." }, { status: 404 });
    }
    return Response.json({ ok: true, status });
  } catch (error) {
    console.error("Gagal memproses notifikasi Midtrans:", error);
    return Response.json(
      { ok: false, error: "Gagal memproses notifikasi." },
      { status: 500 }
    );
  }
}
