"use client";

import { useState } from "react";
import { ActionCard } from "@/components/ui/info-cards";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
  textAreaClassName,
} from "@/components/ui/styles";
import { useUpdateCustomerMutation } from "@/features/customer/customer-queries";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerDetail } from "@/types/customer";

type CustomerNotesCardProps = {
  customer: CustomerDetail;
};

export function CustomerNotesCard({ customer }: CustomerNotesCardProps) {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const updateCustomer = useUpdateCustomerMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(customer.notes ?? "");

  const canEdit =
    currentTenant?.role === "OWNER" || currentTenant?.role === "MANAGER";

  async function handleSave() {
    updateCustomer.reset();

    try {
      await updateCustomer.mutateAsync({
        customerId: customer.id,
        input: {
          name: customer.name,
          phone: customer.phone ?? undefined,
          email: customer.email ?? undefined,
          notes: draft.trim() || undefined,
        },
      });
      setIsEditing(false);
    } catch {
      // The mutation error remains available while the editor stays open.
    }
  }

  return (
    <ActionCard
      eyebrow="Internal notes"
      title="Customer notes"
      description="Private context for scheduling, service preferences, and handoff."
    >
      <div className="space-y-3 text-sm">
        {isEditing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className={textAreaClassName}
              rows={5}
              placeholder="Add internal notes about this customer..."
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={updateCustomer.isPending}
                onClick={() => void handleSave()}
                className={primaryButtonClassName}
              >
                {updateCustomer.isPending ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                disabled={updateCustomer.isPending}
                onClick={() => {
                  setDraft(customer.notes ?? "");
                  setIsEditing(false);
                  updateCustomer.reset();
                }}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>
            </div>
            {updateCustomer.error ? (
              <p className="text-[var(--color-danger)]">
                {updateCustomer.error.message || "Failed to save notes."}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap leading-6 text-[var(--color-text-secondary)]">
              {customer.notes || "No notes yet."}
            </p>
            {canEdit ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(customer.notes ?? "");
                  updateCustomer.reset();
                  setIsEditing(true);
                }}
                className={secondaryButtonClassName}
              >
                {customer.notes ? "Edit notes" : "Add notes"}
              </button>
            ) : null}
          </>
        )}
      </div>
    </ActionCard>
  );
}
