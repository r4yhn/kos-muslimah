/**
 * Kelas Tailwind bersama untuk seluruh form & tombol panel.
 * Mengikuti DESIGN.MD (dark teal, aksen terracotta, touch-target >= 44px).
 */

export const inputClass =
  "min-h-[44px] w-full rounded-md border border-primary/30 bg-background/70 px-3.5 text-sm text-white outline-none transition-[border-color,background-color] duration-[100ms] ease-brand placeholder:text-primary/40 hover:border-primary/60 focus:border-primary focus:bg-background";

export const selectClass = `${inputClass} cursor-pointer`;

export const textareaClass =
  "min-h-[96px] w-full rounded-md border border-primary/30 bg-background/70 px-3.5 py-2.5 text-sm text-white outline-none transition-[border-color,background-color] duration-[100ms] ease-brand placeholder:text-primary/40 hover:border-primary/60 focus:border-primary focus:bg-background";

export const labelClass =
  "font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary";

export const fieldClass = "flex flex-col gap-2";

export const helpClass = "text-xs leading-relaxed text-white/45";

export const errorBoxClass =
  "flex items-start gap-2.5 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm text-red-200";

export const btnPrimaryClass =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-on-primary transition-[box-shadow,filter,transform] duration-[100ms] ease-brand hover:shadow-card hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

export const btnSecondaryClass =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-primary/30 px-4 text-sm font-bold text-white/80 transition-all duration-[100ms] ease-brand hover:border-primary hover:bg-primary/10 hover:text-primary active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

export const btnDangerClass =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-red-400/30 px-4 text-sm font-bold text-red-200/80 transition-all duration-[100ms] ease-brand hover:border-red-400 hover:bg-red-400/10 hover:text-red-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";

export const btnIconGhostClass =
  "inline-flex size-[44px] items-center justify-center rounded-md border border-white/10 text-white/50 transition-all duration-[100ms] ease-brand hover:border-white/20 hover:bg-white/5 hover:text-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";

export const btnDangerIconGhostClass =
  "inline-flex size-[44px] items-center justify-center rounded-md border border-red-400/20 text-red-200/60 transition-all duration-[100ms] ease-brand hover:border-red-400/60 hover:bg-red-400/10 hover:text-red-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";

export const cardClass = "rounded-xl border border-primary/20 bg-surface shadow-card";

export const tableHeadClass =
  "px-5 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60";

export const cellClass = "px-5 py-3";

export const eyebrowClass =
  "font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-primary/80";

export const headingClass =
  "mt-2 font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl";
