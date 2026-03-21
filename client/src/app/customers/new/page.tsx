"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CustomerForm } from "@/components/customer/customer-form";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FormSurface } from "@/components/ui/form-surface";
import { createCustomerRequest } from "@/features/customer/customer-api";
import type { CustomerFormValues } from "@/features/customer/customer-schema";
import { useAuthStore } from "@/store/auth-store";

function canManageCustomers(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export default function NewCustomerPage() {
  const router = useRouter();
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [submitError, setSubmitError] = useState<string | null>(null);

  return (
    <AppShell
      title="Create Customer"
    >
      <AuthGuard>
        {canManageCustomers(currentTenant?.role) ? (
          <FormSurface
            eyebrow="Customer"
            title="New customer"
            description="Capture a clean customer profile you can reuse across future jobs."
          >
            <CustomerForm
              submitLabel="Create customer"
              submittingLabel="Creating customer..."
              submitError={submitError}
              onSubmit={async (values: CustomerFormValues) => {
                setSubmitError(null);

                try {
                  const created = await withAccessTokenRetry((accessToken) =>
                    createCustomerRequest(accessToken, values),
                  );
                  router.push(`/customers/${created.id}`);
                } catch (error) {
                  setSubmitError(
                    error instanceof Error
                      ? error.message
                      : "Failed to create customer.",
                  );
                }
              }}
            />
          </FormSurface>
        ) : (
          <EmptyStatePanel
            title="Customer creation is unavailable"
            description="Your current role cannot create customer records in this workspace."
          />
        )}
      </AuthGuard>
    </AppShell>
  );
}
