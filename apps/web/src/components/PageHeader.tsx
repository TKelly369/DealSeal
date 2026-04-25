type PageHeaderProps = {
  title: string;
  subtitle: string;
  kicker?: string;
  actions?: React.ReactNode;
};

export function PageHeader({ title, subtitle, kicker, actions }: PageHeaderProps) {
  return (
    <header className="ds-page-header">
      <div className="ds-page-header__content">
        {kicker ? <p className="ds-page-header__kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="ds-page-header__actions">{actions}</div> : null}
    </header>
  );
}
