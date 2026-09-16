import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Milonga } from "next/font/google";
import "./globals.css";

/**
 * Tipografi DESIGN.MD:
 * - Display/Heading : Milonga (serif) -> utility `font-display`
 * - Body            : DM Sans (weight-floor 600) -> utility `font-sans`
 * - Mono            : DM Mono -> utility `font-mono`
 */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const milonga = Milonga({
  variable: "--font-milonga",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Kos Pondok Muslimah",
    template: "%s | Kos Pondok Muslimah",
  },
  description:
    "Sistem Informasi Manajemen Kos Pondok Muslimah — kelola kamar, penghuni, dan pembayaran sewa bulanan.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${dmSans.variable} ${milonga.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
