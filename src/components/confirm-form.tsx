"use client";

import type { FormEvent, ReactNode } from "react";

type ConfirmFormProps = {
  /** Server action yang dijalankan saat form disubmit. */
  action: (formData: FormData) => void | Promise<void>;
  /** Pesan konfirmasi sebelum submit. Kosongkan/omit bila tanpa konfirmasi. */
  confirmMessage?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Pembungkus <form action={serverAction}> dengan dialog konfirmasi
 * berbasis window.confirm untuk aksi destruktif (hapus, tandai keluar).
 */
export function ConfirmForm({
  action,
  confirmMessage,
  children,
  className,
}: ConfirmFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} className={className} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
