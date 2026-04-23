import { WorkspaceClient } from "./WorkspaceClient";

export default async function WorkspaceByIdPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  return (
    <div>
      <h1>Transaction workspace</h1>
      <p style={{ color: "var(--muted)" }}>Session is the same JWT as after sign-in at <code>/login</code>.</p>
      <WorkspaceClient transactionId={transactionId} />
    </div>
  );
}
