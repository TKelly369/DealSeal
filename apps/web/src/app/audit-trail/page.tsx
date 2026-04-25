import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";

const events = [
  {
    event: "Record Created",
    actor: "Intake Service",
    timestamp: "2026-04-25 09:14 UTC",
    hash: "0x8f1d...a294",
  },
  {
    event: "Record Locked",
    actor: "Operations Analyst",
    timestamp: "2026-04-25 09:19 UTC",
    hash: "0x8f1d...a294",
  },
  {
    event: "Certified Rendering Generated",
    actor: "Rendering Service",
    timestamp: "2026-04-25 09:22 UTC",
    hash: "0x4d7a...91ce",
  },
  {
    event: "Non-Authoritative Copy Generated",
    actor: "Portfolio Manager",
    timestamp: "2026-04-25 09:25 UTC",
    hash: "0x2b13...4f0d",
  },
  {
    event: "Verification Requested",
    actor: "Lender API Client",
    timestamp: "2026-04-25 09:30 UTC",
    hash: "0x4d7a...91ce",
  },
];

export default function AuditTrailPage() {
  return (
    <Section
      title="Audit Integrity Timeline"
      subtitle="Trace all governing record and rendering events with actor attribution, cryptographic references, and custody confirmation."
    >
      <Card>
        <ul className="ds-audit-list">
          {events.map((event) => (
            <li key={`${event.event}-${event.timestamp}`} className="ds-audit-item">
              <div>
                <p className="ds-audit-event__title">{event.event}</p>
                <p className="ds-audit-meta">Actor: {event.actor}</p>
              </div>
              <div className="ds-audit-meta">
                <p>{event.timestamp}</p>
                <p className="ds-audit-event__hash">{event.hash}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
