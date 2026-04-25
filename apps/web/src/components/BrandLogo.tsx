import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  /** compact = nav; hero = larger mark */
  variant?: "nav" | "hero" | "footer";
  className?: string;
  href?: string | null;
};

const sizes = { nav: { w: 140, h: 40 }, hero: { w: 220, h: 64 }, footer: { w: 120, h: 36 } } as const;

/**
 * Primary mark: `public/brand/dealseal-logo.png` (copied from repo root asset).
 */
export function BrandLogo({ variant = "nav", className, href = "/" }: BrandLogoProps) {
  const { w, h } = sizes[variant];
  const img = (
    <Image
      src="/brand/dealseal-logo.png"
      alt="DealSeal"
      width={w}
      height={h}
      className={className}
      priority={variant === "hero"}
      style={{ height: "auto", width: "100%", maxWidth: w, objectFit: "contain" }}
    />
  );
  if (href === null) {
    return <span className="ds-brand-logo">{img}</span>;
  }
  return (
    <Link href={href} className="ds-brand-logo" style={{ display: "inline-block", lineHeight: 0 }}>
      {img}
    </Link>
  );
}
