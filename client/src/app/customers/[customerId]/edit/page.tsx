"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CustomerForm } from "@/components/customer/customer-form";
import { AppShell } from "@/components/ui/app-shell";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { FormSurface } from "@/components/ui/form-surface";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { LoadingPanel } from "@/components/ui/loading-panel";
import {
  getCustomerDetailRequest,
  updateCustomerRequest,
} from "@/features/customer/customer-api";
import type { CustomerFormValues } from "@/features/customer/customer-schema";
import { useAuthStore } from "@/store/auth-store";

function canManageCustomers(role: string | undefined) {
  return role === "OWNER" || role === "MANAGER";
}

export default function EditCustomerPage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const customerId = typeof params.customerId === "string" ? params.customerId : "";
  const currentTenant = useAuthStore((state) => state.currentTenant);
  const withAccessTokenRetry = useAuthStore((state) => state.withAccessTokenRetry);
  const [defaultValues, setDefaultValues] = useState<CustomerFormValues | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!customerId) {
      setLoadError("Customer id is missing.");
      setIsLoading(false);
      return;
    }

    void (async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const loaded = await withAccessTokenRetry((accessToken) =>
          getCustomerDetailRequest(accessToken, customerId),
        );

        if (!cancelled) {
          setDefaultValues({
            name: loaded.name,
            phone: loaded.phone ?? "",
            email: loaded.email ?? "",
            address: loaded.address ?? "",
          });
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load customer.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, withAccessTokenRetry]);

  return (
    <AppShell
      title="Edit Customer"
    >
      <AuthGuard>
        {!canManageCustomers(currentTenant?.role) ? (
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
            {isLoading ? <LoadingPanel label="Loading customer..." /> : null}
            {loadError ? <InlineErrorBanner message={loadError} /> : null}

            {defaultValues ? (
            <CustomerForm
              defaultValues={defaultValues}
              submitLabel="Save changes"
              submittingLabel="Saving changes..."
              submitError={submitError}
              onSubmit={async (values: CustomerFormValues) => {
                setSubmitError(null);

                try {
                  await withAccessTokenRetry((accessToken) =>
                    updateCustomerRequest(accessToken, customerId, values),
                  );
                  router.push(`/customers/${customerId}`);
                } catch (error) {
                  setSubmitError(
                    error instanceof Error
                      ? error.message
                      : "Failed to update customer.",
                    );
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
