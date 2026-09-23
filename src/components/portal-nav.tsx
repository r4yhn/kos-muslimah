"use client";

import {
  CreditCard,
  Home,
  MessageSquareWarning,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type PortalNavProps = {
  /**
   * true = penghuni baru belum melunasi "Pembayaran Awal" sehingga menu lain
   * dikunci dan hanya halaman pembayaran awal yang tersedia.
   */
  terkunci: boolean;
};

/**
 * Navigasi portal penghuni — menyorot link aktif sesuai path.
 *
 * Catatan: menu **Notifikasi** sengaja TIDAK ditampilkan di navbar (penghuni
 * tidak perlu tahu urusan jatuh tempo/pengarsipan). Aksesnya dipindahkan ke
 * kartu **Menu Penghuni** pada beranda portal (`/portal/notifikasi`).
 */
export function PortalNav({ terkunci }: PortalNavProps) {
  const pathname = usePathname();

  const links = terkunci
    ? [{ href: "/portal/bayar-awal", label: "Pembayaran Awal", icon: CreditCard }]
    : [
        { href: "/portal", label: "Beranda", icon: Home },
        { href: "/portal/bayar", label: "Bayar Sewa", icon: CreditCard },
        { href: "/portal/riwayat", label: "Riwayat Pembayaran", icon: ReceiptText },
        {
          href: "/portal/pengaduan",
          label: "Pengaduan",
          icon: MessageSquareWarning,
        },
      ];

  function isActive(href: string): boolean {
    return pathname === href || (href !== "/portal" && pathname.startsWith(`${href}/`));
  }

  return (
    <nav
      aria-label="Navigasi portal penghuni"
      className="-mx-1 overflow-x-auto scrollbar-none"
    >
      <ul className="flex w-max items-center gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-md px-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.15em] transition-all duration-[100ms] ease-brand ${
                  active
                    ? "bg-primary/15 text-primary shadow-card"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
