import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Upload bukti pembayaran via server action dikirim sebagai multipart
   * dengan data URL base64; batas default 1MB dinaikkan (validasi ukuran
   * file tetap dilakukan di kode, maks ±3MB).
   */
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
