"use client";

import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/Button";

type AppHeaderProps = {
  title: string;
  subtitle: string;
  onSignOut?: () => Promise<void> | void;
};

export function AppHeader({ title, subtitle, onSignOut }: AppHeaderProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    if (onSignOut) {
      await onSignOut();
      return;
    }
    router.push("/login");
  };

  return (
    <header className="ds-header">
      <div className="ds-header__inner">
        <div className="ds-header__title-group">
          <BrandLogo variant="nav" href="/" className="ds-header__logo" />
          <div>
            <h1 className="ds-header__title">DealSeal</h1>
            <p className="ds-header__subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="ds-header__account">
          <div className="ds-avatar" aria-hidden>
            DS
          </div>
          <span className="ds-account-label">Account</span>
          <button type="button" className="ds-account-dropdown" aria-label="Open account menu">
            ▾
          </button>
          <Button href="/workspace" className="ds-header__new-deal">
            New Contract
          </Button>
          <Button variant="secondary" onClick={() => void handleSignOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
