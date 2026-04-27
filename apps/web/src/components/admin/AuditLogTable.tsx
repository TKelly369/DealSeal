"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { AuditLogRow } from "@/app/admin/actions";
import { EmptyState } from "@/components/shared/EmptyState";

const col = createColumnHelper<AuditLogRow>();

export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  const columns = useMemo(
    () => [
      col.accessor("timestamp", {
        header: "Timestamp",
        cell: ({ getValue }) => new Date(getValue()).toLocaleString(),
      }),
      col.accessor("adminUser", { header: "Admin User" }),
      col.accessor("action", { header: "Action" }),
      col.accessor("targetEntity", { header: "Target Entity" }),
    ],
    [],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  if (rows.length === 0) {
    return <EmptyState icon="🧾" title="No audit logs found" description="No immutable admin events recorded yet." />;
  }
  return (
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
  );
}
