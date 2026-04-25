import Link from "next/link";

type ButtonVariant = "primary" | "secondary";

type ButtonBaseProps = {
  variant?: ButtonVariant;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

type ButtonAsLinkProps = ButtonBaseProps & {
  href: string;
  onClick?: never;
  type?: never;
  disabled?: never;
};

type ButtonAsButtonProps = ButtonBaseProps & {
  href?: never;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
};

type ButtonProps = ButtonAsLinkProps | ButtonAsButtonProps;

function getClassName(variant: ButtonVariant, className?: string) {
  const base = variant === "primary" ? "ds-ui-button ds-ui-button--primary" : "ds-ui-button ds-ui-button--secondary";
  return className ? `${base} ${className}` : base;
}

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";
  const className = getClassName(variant, props.className);

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={className}>
        {props.children}
      </Link>
    );
  }

  return (
    <button type={props.type ?? "button"} className={className} onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  );
}
