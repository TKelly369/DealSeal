import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function SiteHeader() {
  return (
    <header className="ds-site-header">
      <div className="ds-site-header__inner">
        <BrandLogo variant="nav" href="/" />
        <nav className="ds-site-header__nav" aria-label="Primary">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/verify/test">Verify</Link>
          <a href={`${apiBase}/health`} target="_blank" rel="noreferrer">
            API health
          </a>
        </nav>
      </div>
    </header>
  );
}
