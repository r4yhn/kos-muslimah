/**
 * Helper integrasi Midtrans Snap (server-only).
 *
 * Pembayaran online sungguhan: penghuni memilih paket, server membuat order
 * Snap (token), lalu halaman portal menampilkan popup/redirect Snap. Saat
 * Midtrans melaporkan `settlement` (webhook / cek status), sistem mencatat
 * baris `pembayaran` Lunas secara otomatis (lihat `lib/payment-online.ts`).
 *
 * Mode dikendalikan env:
 * - MIDTRANS_SERVER_KEY   -> kunci server (sandbox diawali "SB-Mid-server-")
 * - MIDTRANS_CLIENT_KEY   -> kunci klien untuk Snap.js
 * - MIDTRANS_IS_PRODUCTION= "true" untuk produksi (default: sandbox)
 */

import { createHash } from "node:crypto";

export type MidtransStatus =
  | "pending"
  | "settlement"
  | "challenge"
  | "expire"
  | "cancel"
  | "deny";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

const serverKey = env("MIDTRANS_SERVER_KEY");
const clientKey = env("MIDTRANS_CLIENT_KEY");
const isProduction = env("MIDTRANS_IS_PRODUCTION") === "true";

/** Base URL API Snap untuk membuat transaksi. */
const SNAP_API_URL = isProduction
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

/** Base URL Snap.js yang dimuat browser. */
const SNAP_JS_URL = isProduction
  ? "https://app.midtrans.com/snap/snap.js"
  : "https://app.sandbox.midtrans.com/snap/snap.js";

/** Base URL API v2 Midtrans (untuk cek status order). */
const API_V2_URL = isProduction
  ? "https://api.midtrans.com/v2"
  : "https://api.sandbox.midtrans.com/v2";

/** True bila kunci Midtrans sudah diisi sehingga tombol pembayaran muncul. */
export function isMidtransConfigured(): boolean {
  return Boolean(serverKey && clientKey);
}

export function getMidtransClientKey(): string {
  return clientKey;
}

export function getMidtransSnapJsUrl(): string {
  return SNAP_JS_URL;
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

export type SnapItem = {
  id: string;
  price: number;
  quantity: number;
  name: string;
};

export type SnapCustomer = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

export type SnapResult = {
  token: string;
  redirect_url: string;
};

export type SnapError = {
  status_code: string;
  status_message: string;
};

/**
 * Buat transaksi Snap di Midtrans.
 * @throws Error bila Midtrans menolak / tidak dikonfigurasi.
 */
export async function buatSnapTransaksi(params: {
  orderId: string;
  grossAmount: number;
  customerDetails: SnapCustomer;
  itemDetails: SnapItem[];
}): Promise<SnapResult> {
  if (!isMidtransConfigured()) {
    throw new Error("Payment gateway (Midtrans) belum dikonfigurasi.");
  }

  const body = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.grossAmount,
    },
    item_details: params.itemDetails,
    customer_details: params.customerDetails,
    credit_card: { secure: true },
    // Default kedaluwarsa Snap: 1 hari (cukup untuk pembayaran manual/VA/QRIS).
    expiry: { unit: "days", duration: 1 },
  };

  const res = await fetch(SNAP_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as
    | (SnapResult & SnapError)
    | null;

  if (!res.ok || !data || !("token" in data)) {
    const pesan =
      data && "status_message" in data
        ? data.status_message
        : `Midtrans mengembalikan HTTP ${res.status}`;
    throw new Error(`Gagal membuat pembayaran: ${pesan}`);
  }

  return { token: data.token, redirect_url: data.redirect_url };
}

/**
 * Cek status order di Midtrans (dipakai saat penghuni menekan
 * "Saya sudah bayar" atau setelah popup Snap sukses).
 */
export async function cekStatusMidtrans(
  orderId: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_V2_URL}/${orderId}/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: authHeader(),
    },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !data) {
    throw new Error(`Gagal mengecek status pembayaran (HTTP ${res.status}).`);
  }
  return data;
}

/**
 * Normalisasi status Midtrans (transaction_status + fraud_status) menjadi
 * status internal. Hanya "settlement" yang berarti pembayaran diterima.
 */
export function normalisasiStatusMidtrans(payload: {
  transaction_status?: string;
  fraud_status?: string;
}): MidtransStatus {
  const status = payload.transaction_status ?? "";
  const fraud = payload.fraud_status ?? "";

  switch (status) {
    case "capture":
      return fraud === "accept" ? "settlement" : "challenge";
    case "settlement":
      return "settlement";
    case "challenge":
      return "challenge";
    case "pending":
      return "pending";
    case "deny":
      return "deny";
    case "cancel":
    case "failure":
      return "cancel";
    case "expire":
      return "expire";
    case "refund":
    case "partial_refund":
      return "cancel";
    default:
      return "pending";
  }
}

/**
 * Verifikasi signature notifikasi HTTP Midtrans:
 * SHA512(order_id + status_code + gross_amount + ServerKey).
 */
export function verifikasiSignatureMidtrans(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  if (!serverKey) return false;
  const hash = createHash("sha512")
    .update(
      `${params.orderId}${params.statusCode}${params.grossAmount}${serverKey}`
    )
    .digest("hex");
  return hash === params.signatureKey;
}
