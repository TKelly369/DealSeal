type SectionProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export function Section({ title, subtitle, children, actions }: SectionProps) {
  return (
    <section className="ds-section">
      <div className="ds-section__header">
        <div>
          <h2 className="ds-section__title">{title}</h2>
          {subtitle ? <p className="ds-section__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="ds-section__actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
