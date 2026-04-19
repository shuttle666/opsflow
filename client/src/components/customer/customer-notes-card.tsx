"use client";

import { useEffect, useState } from "react";
import { ActionCard } from "@/components/ui/info-cards";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
  textAreaClassName,
} from "@/components/ui/styles";
import { updateCustomerRequest } from "@/features/customer/customer-api";
import { useAuthStore } from "@/store/auth-store";
import type { CustomerDetail } from "@/types/customer";

type CustomerNotesCardProps = {
  customer: CustomerDetail;
  onCustomerChange: (customer: CustomerDetail) => void;
};

export function CustomerNotesCard({
  customer,
  onCustomerChange,
}: CustomerNotesCardProps) {
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore(
    (state) => state.withAccessTokenRetry,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(customer.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit =
    currentTenant?.role === "OWNER" || currentTenant?.role === "MANAGER";

  useEffect(() => {
    setDraft(customer.notes ?? "");
  }, [customer.notes]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    try {
      await withAccessTokenRetry((accessToken) =>
        updateCustomerRequest(accessToken, customer.id, {
          name: customer.name,
          phone: customer.phone ?? undefined,
          email: customer.email ?? undefined,
          address: customer.address ?? undefined,
          notes: draft.trim() || undefined,
        }),
      );
      onCustomerChange({ ...customer, notes: draft.trim() || null });
      setIsEditing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save notes.",
      );
    } finally {
      setIsSaving(false);
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
                disabled={isSaving}
                onClick={() => void handleSave()}
                className={primaryButtonClassName}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setDraft(customer.notes ?? "");
                  setIsEditing(false);
                  setError(null);
                }}
                className={secondaryButtonClassName}
              >
                Cancel
              </button>
            </div>
            {error ? <p className="text-[var(--color-danger)]">{error}</p> : null}
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap leading-6 text-[var(--color-text-secondary)]">
              {customer.notes || "No notes yet."}
            </p>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
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
