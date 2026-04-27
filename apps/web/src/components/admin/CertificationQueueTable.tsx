"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CertificationQueueRow } from "@/app/admin/actions";
import { EmptyState } from "@/components/shared/EmptyState";
import { CertificationReviewSheet } from "@/components/admin/CertificationReviewSheet";

const col = createColumnHelper<CertificationQueueRow>();

export function CertificationQueueTable({
  rows,
  page,
  pageCount,
}: {
  rows: CertificationQueueRow[];
  page: number;
  pageCount: number;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [active, setActive] = useState<CertificationQueueRow | null>(null);
  const [open, setOpen] = useState(false);

  const columns = useMemo(
    () => [
      col.accessor("id", { header: "Document ID" }),
      col.accessor("submittedBy", { header: "Submitted By" }),
      col.accessor("documentType", { header: "Document Type" }),
      col.accessor("dateSubmitted", {
        header: "Date Submitted",
        cell: ({ getValue }) => new Date(getValue()).toLocaleString(),
      }),
      col.accessor("status", { header: "Status" }),
      col.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setActive(row.original);
              setOpen(true);
            }}
          >
            Review
          </button>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  if (rows.length === 0) {
    return <EmptyState icon="📄" title="No pending certification items" description="Queue is clear." />;
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Pending Certification</h2>
      {notice ? <p style={{ color: "var(--verified)" }}>{notice}</p> : null}
      <table className="ds-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button className="btn btn-secondary" onClick={() => router.push(`/admin/documents?page=${Math.max(1, page - 1)}`)} disabled={page <= 1}>
          Prev
        </button>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          Page {page} / {pageCount}
        </span>
        <button
          className="btn btn-secondary"
          onClick={() => router.push(`/admin/documents?page=${page + 1}`)}
          disabled={page >= pageCount}
        >
          Next
        </button>
      </div>
      <CertificationReviewSheet
        item={active}
        open={open}
        onOpenChange={setOpen}
        onDone={(msg) => {
          setNotice(msg);
          router.refresh();
        }}
      />
    </div>
  );
}
