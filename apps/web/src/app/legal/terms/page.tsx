export default function TermsPage() {
  return (
    <main style={{ maxWidth: 920, margin: "2rem auto", padding: "0 1rem 2rem", color: "#e5e5e5", lineHeight: 1.7 }}>
      <h1 style={{ color: "#fff", marginBottom: "0.5rem" }}>Terms of Service</h1>
      <p style={{ marginTop: 0, color: "#cbd5e1" }}>
        Dear DealSeal User,
      </p>
      <p style={{ color: "#cbd5e1" }}>
        We are excited to have you on the DealSeal platform as we continue building a more secure, compliant, and
        intelligent infrastructure for automotive transactions.
      </p>
      <p style={{ color: "#cbd5e1" }}>
        As part of your continued access and use of DealSeal, we are implementing updated Terms of Service, Risk
        Allocation, and Platform Use Requirements. These terms are designed to clearly define how the platform operates
        and to ensure proper use across all dealers, lenders, and enterprise participants.
      </p>

      <section style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: "1rem 1.1rem", background: "#101010", marginTop: "1rem" }}>
        <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "0.55rem" }}>Key Points You Should Understand</h2>

        <h3 style={{ color: "#fff", marginBottom: "0.4rem" }}>1. DealSeal is a Technology Platform Only</h3>
        <p style={{ marginTop: 0, color: "#cbd5e1" }}>
          DealSeal provides workflow automation, document control, AI-assisted validation, and compliance-support tools.
          It does not act as a dealer, lender, creditor, broker, or legal advisor.
        </p>

        <h3 style={{ color: "#fff", marginBottom: "0.4rem" }}>2. You Are Responsible for Your Transactions</h3>
        <p style={{ marginTop: 0, color: "#cbd5e1" }}>All users remain fully responsible for:</p>
        <ul style={{ color: "#cbd5e1" }}>
          <li>Deal structure and pricing</li>
          <li>Accuracy of all entered data</li>
          <li>Compliance with federal and state laws</li>
          <li>Consumer disclosures and consent</li>
          <li>Document review and execution</li>
          <li>Lender submission and funding outcomes</li>
        </ul>

        <h3 style={{ color: "#fff", marginBottom: "0.4rem" }}>3. AI and Automation Are Support Tools</h3>
        <p style={{ marginTop: 0, color: "#cbd5e1" }}>
          DealSeal&apos;s AI assists with compliance and document handling but does not guarantee accuracy, legality,
          enforceability, or funding.
        </p>

        <h3 style={{ color: "#fff", marginBottom: "0.4rem" }}>4. No Guarantee of Outcomes</h3>
        <p style={{ marginTop: 0, color: "#cbd5e1" }}>DealSeal does not guarantee:</p>
        <ul style={{ color: "#cbd5e1" }}>
          <li>Loan approvals or funding</li>
          <li>Contract enforceability</li>
          <li>Assignment validity</li>
          <li>Title or lien perfection</li>
          <li>Repossession or replevin success</li>
          <li>Litigation outcomes</li>
        </ul>

        <h3 style={{ color: "#fff", marginBottom: "0.4rem" }}>5. Hold Harmless &amp; Indemnification</h3>
        <p style={{ marginTop: 0, color: "#cbd5e1" }}>
          By using DealSeal, you agree to defend, indemnify, and hold DealSeal harmless from any claims, losses, or
          disputes arising from:
        </p>
        <ul style={{ color: "#cbd5e1" }}>
          <li>Your data</li>
          <li>Your documents</li>
          <li>Your transactions</li>
          <li>Your compliance obligations</li>
          <li>Any adverse business, legal, or regulatory outcomes</li>
        </ul>

        <h3 style={{ color: "#fff", marginBottom: "0.4rem" }}>6. Required Human Review</h3>
        <p style={{ marginTop: 0, color: "#cbd5e1" }}>
          No transaction should be considered complete without your independent review. You must verify all documents and
          deal terms before execution or submission.
        </p>

        <h3 style={{ color: "#fff", marginBottom: "0.4rem" }}>7. Platform Controls &amp; Compliance Workflow</h3>
        <p style={{ marginTop: 0, color: "#cbd5e1", marginBottom: 0 }}>
          Certain required disclosures and documents must be uploaded before progressing within the system. These controls
          are mandatory and cannot be bypassed.
        </p>
      </section>

      <section style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: "1rem 1.1rem", background: "#101010", marginTop: "1rem" }}>
        <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "0.55rem" }}>Acceptance Required</h2>
        <p style={{ marginTop: 0, color: "#cbd5e1" }}>
          By continuing to access or use the DealSeal platform, you acknowledge and agree that:
        </p>
        <ul style={{ color: "#cbd5e1" }}>
          <li>You have read and understand the Terms of Service</li>
          <li>You are solely responsible for legal and transactional compliance</li>
          <li>DealSeal is not liable for transaction outcomes</li>
          <li>You agree to the hold harmless and limitation of liability provisions</li>
        </ul>
        <p style={{ marginBottom: 0, color: "#cbd5e1" }}>
          If you do not agree with these terms, you must discontinue use of the platform immediately.
        </p>
      </section>

      <section style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: "1rem 1.1rem", background: "#101010", marginTop: "1rem" }}>
        <h2 style={{ color: "#fff", marginTop: 0, marginBottom: "0.55rem" }}>Next Steps</h2>
        <p style={{ color: "#cbd5e1" }}>
          You will be prompted within the platform to formally accept these Terms before continuing with deal activity.
        </p>
        <p style={{ color: "#cbd5e1", marginBottom: "0.6rem" }}>
          If you have any questions or require clarification, please contact our support team.
        </p>
        <p style={{ color: "#cbd5e1", marginBottom: "0.45rem" }}>
          We appreciate your partnership as we build a stronger, more reliable standard for automotive transactions.
        </p>
        <p style={{ color: "#cbd5e1", marginBottom: 0 }}>
          Sincerely,
          <br />
          DealSeal Legal &amp; Compliance Team
          <br />
          DealSeal Platform
        </p>
      </section>
    </main>
  );
}
