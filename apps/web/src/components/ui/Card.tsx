type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return <section className={`ds-card${className ? ` ${className}` : ""}`}>{children}</section>;
}
