type StatCardTone = "default" | "success" | "warning" | "verification" | "neutral";

const toneClass: Record<StatCardTone, string> = {
  default: "ds-stat-card--primary",
  success: "ds-stat-card--teal",
  warning: "ds-stat-card--gold",
  verification: "ds-stat-card--teal",
  neutral: "ds-stat-card--neutral",
};

type StatCardProps = {
  title?: string;
  label?: string;
  value: string | number;
  description?: string;
  detail?: string;
  trend?: string;
  tone?: StatCardTone;
};

export function StatCard({ title, label, value, description, detail, trend, tone = "default" }: StatCardProps) {
  const heading = title ?? label ?? "Metric";
  const body = description ?? detail;
  return (
    <article className={`card ds-stat-card ${toneClass[tone]}`}>
      <p className="ds-stat-card__label">{heading}</p>
      <p className="ds-stat-card__value">{value}</p>
      {body ? <p className="ds-stat-card__description">{body}</p> : null}
      {trend ? <p className="ds-stat-card__description">{trend}</p> : null}
    </article>
  );
}
