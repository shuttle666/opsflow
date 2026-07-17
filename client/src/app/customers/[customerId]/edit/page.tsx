"use client";

import { useParams, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CustomerForm } from "@/components/customer/customer-form";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FormSurface } from "@/components/ui/form-surface";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import {
  useCustomerDetailQuery,
  useUpdateCustomerMutation,
} from "@/features/customer/customer-queries";
import type { CustomerFormValues } from "@/features/customer/customer-schema";
import { getApiErrorView } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

function canManageCustomers(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export default function EditCustomerPage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const customerId = typeof params.customerId === "string" ? params.customerId : "";
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const allowManage = canManageCustomers(currentTenant?.role);
  const customerQuery = useCustomerDetailQuery(customerId, {
    enabled: allowManage,
  });
  const updateCustomer = useUpdateCustomerMutation();
  const defaultValues: CustomerFormValues | null = customerQuery.data
    ? {
        name: customerQuery.data.name,
        phone: customerQuery.data.phone ?? "",
        email: customerQuery.data.email ?? "",
      }
    : null;
  const loadError = !customerId
    ? "Customer id is missing."
    : customerQuery.error
      ? getApiErrorView(customerQuery.error, "Failed to load customer.")
      : null;
  const submitError = updateCustomer.error
    ? getApiErrorView(updateCustomer.error, "Failed to update customer.")
    : null;

  return (
    <AppShell
      title="Edit Customer"
    >
      <AuthGuard>
        {!allowManage ? (
          <EmptyStatePanel
            title="Customer editing is unavailable"
            description="Your current role cannot edit customer records in this workspace."
          />
        ) : (
          <FormSurface
            eyebrow="Customer"
            title="Edit customer"
            description="Keep contact details accurate so this customer stays reliable across future jobs."
          >
            {customerQuery.isLoading ? <LoadingPanel label="Loading customer..." /> : null}
            {loadError ? <InlineErrorBanner message={loadError} /> : null}

            {defaultValues ? (
              <CustomerForm
                defaultValues={defaultValues}
                submitLabel="Save changes"
                submittingLabel="Saving changes..."
                submitError={submitError}
                onSubmit={async (values: CustomerFormValues) => {
                  updateCustomer.reset();

                  try {
                    await updateCustomer.mutateAsync({
                      customerId,
                      input: values,
                    });
                    router.push(`/customers/${customerId}`);
                  } catch {
                    // The mutation exposes request-aware feedback through submitError.
                  }
                }}
              />
            ) : null}
          </FormSurface>
        )}
      </AuthGuard>
    </AppShell>
  );
}
