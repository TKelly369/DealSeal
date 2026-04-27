import { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "2rem 1rem" }}>
      <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>{icon}</div>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p style={{ color: "var(--muted)", margin: "0.5rem 0 0" }}>{description}</p>
      {action ? <div style={{ marginTop: "1rem" }}>{action}</div> : null}
    </div>
  );
}
