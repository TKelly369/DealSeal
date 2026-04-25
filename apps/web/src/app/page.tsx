import Link from "next/link";
import { demoRecords } from "@/lib/demo-records";

export default function Page() {
  return (
    <main className="ds-home">
      <header className="ds-home__hero">
        <h1>DealSeal</h1>
        <p>Authoritative Contract Infrastructure</p>
      </header>

      <section className="card ds-home__records">
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
            {demoRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.dealId}</td>
                <td>{record.version}</td>
                <td>
                  <span className="badge ds-badge--verified">{record.status}</span>
                </td>
                <td>{new Date(record.lockedAt).toLocaleString()}</td>
                <td>
                  <Link className="btn" href={`/records/${record.id}`}>
                    Open Record
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
