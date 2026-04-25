import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DealSeal",
    template: "%s | DealSeal",
  },
  description:
    "DealSeal is authoritative contract infrastructure for governing records, certified renderings, and verification custody.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="ds-body">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
