import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="ds-site-footer">
      <div className="ds-site-footer__inner">
        <BrandLogo variant="footer" href="/" />
        <p className="ds-site-footer__tagline">Transaction authority for auto finance</p>
        <div className="ds-site-footer__links">
          <Link href="/">Home</Link>
          <span aria-hidden>·</span>
          <Link href="/verify/test">Public verification</Link>
          <span aria-hidden>·</span>
          <Link href="/login">Sign in</Link>
        </div>
        <p className="ds-site-footer__legal">© {new Date().getFullYear()} DealSeal. All rights reserved.</p>
      </div>
    </footer>
  );
}
