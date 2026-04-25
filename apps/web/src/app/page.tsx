import Link from "next/link";
import { demoRecord } from "@/lib/demo-records";

export default function Page() {
  return (
    <main className="ds-home">
      <header className="ds-home__hero">
        <h1>DealSeal</h1>
        <p>Authoritative Contract Infrastructure</p>
      </header>

      <section className="ds-home__records card">
        <h2>Recent Governing Records</h2>
        <table className="ds-home__table" aria-label="Recent Governing Records">
          <thead>
            <tr>
              <th>Record ID</th>
              <th>Deal ID</th>
              <th>Version</th>
              <th>Status</th>
              <th>Locked At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{demoRecord.id}</td>
              <td>{demoRecord.dealId}</td>
              <td>{demoRecord.version}</td>
              <td>
                <span className="badge ds-badge--verified">{demoRecord.status}</span>
              </td>
              <td>{new Date(demoRecord.lockedAt).toLocaleString()}</td>
              <td>
                <Link href={`/records/${demoRecord.id}`} className="btn">
                  Open Record
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
