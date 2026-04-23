"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { DEFAULT_PRICE_BOOK } from "@dealseal/shared";

type Usage = { id: string; eventType: string; amountUsd: string; recordedAt: string };
type Inv = { id: string; status: string; totalCents: number; createdAt: string };
type Sub = {
  tier: string;
  status: string;
  currentPeriodEnd: string | null;
  stripeSubId: string | null;
  entitlements: {
    includedInPeriod: number;
    sealedInPeriod: number;
    overage: number;
  };
};

export function BillingClient() {
  const [usage, setUsage] = useState<Usage[]>([]);
  const [events, setEvents] = useState<Usage[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [plans, setPlans] = useState<unknown>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);
  const tiers = DEFAULT_PRICE_BOOK.subscription;

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [u, e, inv, p, s] = await Promise.all([
        api<{ items: Usage[] }>("/billing/usage"),
        api<{ items: Usage[] }>("/billing/events?limit=50"),
        api<{ items: Inv[] }>("/billing/invoices"),
        api("/billing/plans"),
        api<Sub>("/billing/subscription").catch(() => null),
      ]);
      setUsage(u.items);
      setEvents(e.items);
      setInvoices(inv.items);
      setPlans(p);
      if (s) setSub(s);
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startCheckout = useCallback(async () => {
    setCheckoutMsg(null);
    try {
      const out = await api<{ url: string }>("/billing/checkout-session", { method: "POST", body: JSON.stringify({}) });
      if (out.url) window.location.href = out.url;
    } catch (e) {
      setCheckoutMsg(String(e));
    }
  }, []);

  const openPortal = useCallback(async () => {
    setCheckoutMsg(null);
    try {
      const out = await api<{ url: string }>("/billing/portal-session", { method: "POST" });
      if (out.url) window.location.href = out.url;
    } catch (e) {
      setCheckoutMsg(String(e));
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      {checkoutMsg && <p style={{ color: "var(--danger)" }}>{checkoutMsg}</p>}
      <div className="row">
        <div className="card" style={{ flex: "1 1 280px" }}>
          <h3>Subscription &amp; entitlements</h3>
          {sub ? (
            <ul style={{ color: "var(--muted)", paddingLeft: "1.2rem", fontSize: 13 }}>
              <li>
                Tier: {sub.tier} — status: {sub.status}
              </li>
              <li>Stripe sub: {sub.stripeSubId ?? "—"}</li>
              <li>Period end: {sub.currentPeriodEnd ?? "—"}</li>
              <li>
                Deals this month: {sub.entitlements.sealedInPeriod} / included {sub.entitlements.includedInPeriod}{" "}
                (overage {sub.entitlements.overage})
              </li>
            </ul>
          ) : (
            <p style={{ color: "var(--muted)" }}>Load subscription (finance/admin)…</p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => void startCheckout()}>
              Stripe checkout (admin/finance)
            </button>
            <button type="button" onClick={() => void openPortal()}>
              Customer portal
            </button>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="card" style={{ flex: "1 1 280px" }}>
          <h3>Subscription tiers (defaults)</h3>
          <ul style={{ color: "var(--muted)", paddingLeft: "1.2rem" }}>
            <li>Starter: ${tiers.STARTER.monthlyUsd}/mo — {tiers.STARTER.includedDeals} deals</li>
            <li>
              Professional: ${tiers.PROFESSIONAL.monthlyUsd}/mo — {tiers.PROFESSIONAL.includedDeals}{" "}
              deals
            </li>
            <li>Enterprise: ${tiers.ENTERPRISE.monthlyUsd}/mo — volume</li>
          </ul>
        </div>
        <div className="card" style={{ flex: "1 1 280px" }}>
          <h3>From API — GET /billing/plans</h3>
          <pre style={{ fontSize: 11, maxHeight: 160, overflow: "auto", color: "var(--muted)" }}>
            {plans ? JSON.stringify(plans, null, 2) : "—"}
          </pre>
        </div>
      </div>
      <div className="card">
        <h3>Usage events (GET /billing/usage & /billing/events)</h3>
        <button type="button" onClick={() => void load()}>
          Refresh
        </button>
        <ul style={{ fontSize: 13, color: "var(--muted)", maxHeight: 200, overflow: "auto" }}>
          {events.map((r) => (
            <li key={r.id}>
              {r.eventType} — {r.amountUsd} @ {r.recordedAt}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>Invoices (GET /billing/invoices)</h3>
        <ul style={{ fontSize: 13, color: "var(--muted)" }}>
          {invoices.map((r) => (
            <li key={r.id}>
              {r.id} · {r.status} · {(r.totalCents / 100).toFixed(2)} usd
            </li>
          ))}
        </ul>
      </div>
      <p style={{ color: "var(--muted)", fontSize: 12 }}>raw usage: {usage.length} rows (same as events subset)</p>
    </div>
  );
}
