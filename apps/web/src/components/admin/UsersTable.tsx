"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
} from "@tanstack/react-table";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminUserRow, suspendUser } from "@/app/admin/actions";
import { EmptyState } from "@/components/shared/EmptyState";
import { EditUserSheet } from "@/components/admin/EditUserSheet";

const col = createColumnHelper<AdminUserRow>();

function badgeClassForRole(role: AdminUserRow["role"]): string {
  if (role === "ADMIN") return "ds-badge--error";
  if (role === "LENDER") return "ds-badge--warning";
  return "ds-badge--verified";
}

export function UsersTable({
  rows,
  page,
  pageCount,
  total,
  role,
  search,
}: {
  rows: AdminUserRow[];
  page: number;
  pageCount: number;
  total: number;
  role: "ALL" | "DEALER" | "LENDER" | "ADMIN";
  search: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<AdminUserRow | null>(null);
  const [confirmUser, setConfirmUser] = useState<AdminUserRow | null>(null);

  const columns = useMemo(
    () => [
      col.accessor("name", { header: "Name" }),
      col.accessor("email", { header: "Email" }),
      col.accessor("role", {
        header: "Role",
        cell: ({ getValue }) => <span className={`badge ${badgeClassForRole(getValue())}`}>{getValue()}</span>,
      }),
      col.accessor("workspace", { header: "Workspace / Dealership" }),
      col.accessor("status", { header: "Status" }),
      col.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setActiveUser(row.original);
                setSheetOpen(true);
              }}
            >
              Edit
            </button>
            {row.original.status !== "SUSPENDED" ? (
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmUser(row.original)}>
                Suspend
              </button>
            ) : null}
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="👤"
        title="No users found"
        description="Try adjusting filters or search criteria."
      />
    );
  }

  const nav = (nextPage: number) => {
    const sp = new URLSearchParams();
    sp.set("page", String(nextPage));
    if (role !== "ALL") sp.set("role", role);
    if (search) sp.set("search", search);
    router.push(`/admin/users?${sp.toString()}`);
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>User Management</h2>
      <p style={{ color: "var(--muted)" }}>Total users: {total}</p>
      {notice ? <p style={{ color: "var(--verified)" }}>{notice}</p> : null}
      <table className="ds-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
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
        <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => nav(page - 1)}>
          Prev
        </button>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>
          Page {page} / {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page >= pageCount}
          onClick={() => nav(page + 1)}
        >
          Next
        </button>
      </div>

      <EditUserSheet
        user={activeUser}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={(msg) => {
          setNotice(msg);
          router.refresh();
        }}
      />

      <AlertDialog.Root open={Boolean(confirmUser)} onOpenChange={(v) => !v && setConfirmUser(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="ds-sheet-overlay" />
          <AlertDialog.Content className="ds-alert-dialog">
            <AlertDialog.Title>Suspend user account?</AlertDialog.Title>
            <AlertDialog.Description style={{ color: "var(--muted)" }}>
              This will restrict login and admin-sensitive actions until reactivated.
            </AlertDialog.Description>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.9rem" }}>
              <AlertDialog.Cancel asChild>
                <button type="button" className="btn btn-secondary">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirmUser) return;
                    startTransition(async () => {
                      await suspendUser({ userId: confirmUser.id });
                      setNotice(`Suspended ${confirmUser.name}`);
                      setConfirmUser(null);
                      router.refresh();
                    });
                  }}
                >
                  Confirm Suspend
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
