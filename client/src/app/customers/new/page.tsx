"use client";

import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CustomerForm } from "@/components/customer/customer-form";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FormSurface } from "@/components/ui/form-surface";
import { useCreateCustomerMutation } from "@/features/customer/customer-queries";
import type { CustomerFormValues } from "@/features/customer/customer-schema";
import { getApiErrorView } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

function canManageCustomers(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export default function NewCustomerPage() {
  const router = useRouter();
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const createCustomer = useCreateCustomerMutation();
  const submitError = createCustomer.error
    ? getApiErrorView(createCustomer.error, "Failed to create customer.")
    : null;

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
                createCustomer.reset();

                try {
                  const created = await createCustomer.mutateAsync(values);
                  router.push(`/customers/${created.id}`);
                } catch {
                  // The mutation exposes request-aware feedback through submitError.
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
