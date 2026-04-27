"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { UserAdminUpdateSchema } from "@/lib/types";
import { AdminUserRow, updateUser } from "@/app/admin/actions";

type FormValues = {
  name: string;
  email: string;
  role: "DEALER" | "LENDER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
};

export function EditUserSheet({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user: AdminUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "DEALER",
      status: user?.status ?? "ACTIVE",
    },
  });

  useEffect(() => {
    reset({
      name: user?.name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "DEALER",
      status: user?.status ?? "ACTIVE",
    });
    setError(null);
  }, [user, reset, open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ds-sheet-overlay" />
        <Dialog.Content className="ds-sheet-content ds-sheet-content-right">
          <div className="ds-sidebar-top">
            <Dialog.Title>Edit User</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close edit user sheet">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>Update account role and status controls.</p>

          <form
            onSubmit={handleSubmit((values) => {
              setError(null);
              const parsed = UserAdminUpdateSchema.safeParse({
                userId: user?.id ?? "",
                data: values,
              });
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? "Invalid input.");
                return;
              }
              startTransition(async () => {
                try {
                  const result = await updateUser(parsed.data);
                  onSaved(result.message);
                  onOpenChange(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to update user.");
                }
              });
            })}
            className="ds-form-grid"
            style={{ gridTemplateColumns: "1fr" }}
          >
            <label>
              Name
              <input {...register("name")} />
            </label>
            <label>
              Email
              <input {...register("email")} />
            </label>
            <label>
              Role
              <select {...register("role")} defaultValue={user?.role}>
                <option value="DEALER">Dealer</option>
                <option value="LENDER">Lender</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label>
              Status
              <select {...register("status")} defaultValue={user?.status}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>
            {error ? <p style={{ color: "#fecaca", margin: 0 }}>{error}</p> : null}
            <button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
