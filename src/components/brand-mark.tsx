type BrandMarkProps = {
  /** Ukuran marka brand. */
  size?: "sm" | "md";
  className?: string;
};

const sizeClass = {
  sm: "size-9 rounded-[8px] text-base",
  md: "size-12 rounded-[9px] text-xl",
};

/**
 * Marka brand terracotta — huruf display "K" di atas panel surface,
 * diberi warm card-shadow sesuai token DESIGN.MD.
 */
export function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center bg-primary font-display leading-none text-on-primary shadow-card ${sizeClass[size]} ${className}`}
    >
      K
    </span>
  );
}
