import Link from "next/link";

type ActionButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

export function ActionButton({ href, children, variant = "primary" }: ActionButtonProps) {
  const className =
    variant === "secondary"
      ? "btn btn-secondary ds-action-button"
      : variant === "ghost"
        ? "btn btn-quiet ds-action-button"
        : "btn ds-action-button";
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
