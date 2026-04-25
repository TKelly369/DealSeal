import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { SessionGate } from "@/components/SessionGate";
import { ConditionalLayout } from "@/components/ConditionalLayout";

export const metadata: Metadata = {
  title: {
    default: "DealSeal - Transaction Authority Platform",
    template: "%s | DealSeal",
  },
  description:
    "DealSeal is a transaction authority platform for auto-finance workflows, auditability, and investor-grade operational visibility.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "DealSeal - Transaction Authority Platform",
    description:
      "Execution-to-lock transaction authority platform for modern auto-finance operations.",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    siteName: "DealSeal",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Suspense
          fallback={
            <div
              className="card"
              style={{ maxWidth: 420, margin: "4rem auto", textAlign: "center", color: "var(--muted)" }}
            >
              Loading…
            </div>
          }
        >
          <SessionGate>
            <ConditionalLayout>{children}</ConditionalLayout>
          </SessionGate>
        </Suspense>
      </body>
    </html>
  );
}
