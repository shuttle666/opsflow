"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FormActions, FormSection } from "@/components/ui/form-surface";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import { inputClassName, primaryButtonClassName } from "@/components/ui/styles";
import {
  customerFormSchema,
  type CustomerFormValues,
} from "@/features/customer/customer-schema";
import type { ApiErrorView } from "@/lib/api-client";

type CustomerFormProps = {
  defaultValues?: CustomerFormValues;
  submitLabel: string;
  submittingLabel: string;
  submitError: string | ApiErrorView | null;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
};

export function CustomerForm({
  defaultValues,
  submitLabel,
  submittingLabel,
  submitError,
  onSubmit,
}: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaultValues ?? {
      name: "",
      phone: "",
      email: "",
    },
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <FormSection
        title="Contact profile"
        description="Capture the details future jobs, assignments, and field communication will rely on."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Customer name</span>
            <input
              {...register("name")}
              className={inputClassName}
              placeholder="Noah Thompson"
            />
            {errors.name ? (
              <p className="text-sm text-rose-600">{errors.name.message}</p>
            ) : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Phone</span>
            <input
              {...register("phone")}
              className={inputClassName}
              placeholder="0412 000 001"
            />
            {errors.phone ? (
              <p className="text-sm text-rose-600">{errors.phone.message}</p>
            ) : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Email</span>
            <input
              {...register("email")}
              className={inputClassName}
              placeholder="noah@example.com"
            />
            {errors.email ? (
              <p className="text-sm text-rose-600">{errors.email.message}</p>
            ) : null}
          </label>
        </div>
      </FormSection>

      <FormActions>
        <button
          type="submit"
          disabled={isSubmitting}
          className={primaryButtonClassName}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        {submitError ? <InlineErrorBanner message={submitError} /> : null}
      </FormActions>
    </form>
  );
}
