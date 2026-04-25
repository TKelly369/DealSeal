type StatCardTone = "default" | "success" | "warning" | "verification" | "neutral";

const toneClass: Record<StatCardTone, string> = {
  default: "ds-stat-card--primary",
  success: "ds-stat-card--teal",
  warning: "ds-stat-card--gold",
  verification: "ds-stat-card--teal",
  neutral: "ds-stat-card--neutral",
};

type StatCardProps = {
  title: string;
  value: string | number;
  detail?: string;
  trend?: string;
  tone?: StatCardTone;
};

export function StatCard({ title, value, detail, trend, tone = "default" }: StatCardProps) {
  return (
    <article className={`card ds-stat-card ${toneClass[tone]}`}>
      <p className="ds-stat-card__label">{title}</p>
      <p className="ds-stat-card__value">{value}</p>
      {detail ? <p className="ds-stat-card__description">{detail}</p> : null}
      {trend ? <p className="ds-stat-card__description">{trend}</p> : null}
    </article>
  );
}
