import { PageHeader } from "@/components/PageHeader";

export default function SettingsPage() {
  return (
    <div className="ds-stack">
      <PageHeader
        kicker="Administration"
        title="Settings"
        subtitle="Configure user governance, API credential controls, and policy defaults to maintain System Custody and enterprise change discipline."
      />
      <section className="ds-grid ds-grid--two">
        <article className="card">
          <h3 className="ds-panel-title">User & role policy</h3>
          <p>
            Define enterprise access boundaries for dealer operators, servicing teams, and legal approvers.
            Audit Integrity controls enforce role-scoped actions.
          </p>
        </article>
        <article className="card">
          <h3 className="ds-panel-title">Verification endpoint policy</h3>
          <p>
            Configure allowed verification domains, webhook signing keys, and endpoint rate controls for
            institutional integration.
          </p>
        </article>
      </section>
    </div>
  );
}
