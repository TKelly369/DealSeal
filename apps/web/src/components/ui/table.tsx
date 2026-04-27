import { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return <table className="ds-table">{children}</table>;
}

export function THead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}

export function TH({ children }: { children: ReactNode }) {
  return <th>{children}</th>;
}

export function TD({ children }: { children: ReactNode }) {
  return <td>{children}</td>;
}
