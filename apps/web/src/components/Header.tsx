import { BrandLogo } from "@/components/BrandLogo";

type HeaderProps = {
  title: string;
  subtitle: string;
  statusLabel: string;
};

export function Header({ title, subtitle, statusLabel }: HeaderProps) {
  return (
    <header className="ds-header">
      <div className="ds-header__inner">
        <div className="ds-header__left">
          <BrandLogo variant="nav" href="/" className="ds-header__logo" />
        </div>
        <div className="ds-header__copy">
          <p className="ds-header__meta">{subtitle}</p>
          <h1 className="ds-header__title">{title}</h1>
        </div>
        <div className="ds-header__actions">
          <span className="badge ds-badge--verified">{statusLabel}</span>
        </div>
      </div>
    </header>
  );
}
