"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  CustomerSearchSelect,
  type CustomerSelectOption,
} from "@/components/customer/customer-search-select";
import { FormActions, FormSection } from "@/components/ui/form-surface";
import { InlineErrorBanner } from "@/components/ui/inline-error-banner";
import {
  inputClassName,
  primaryButtonClassName,
  textAreaClassName,
} from "@/components/ui/styles";
import { jobFormSchema, type JobFormValues } from "@/features/job/job-schema";
import type { ApiErrorView } from "@/lib/api-client";

type JobFormProps = {
  selectedCustomer?: CustomerSelectOption | null;
  defaultValues?: JobFormValues;
  submitLabel: string;
  submittingLabel: string;
  submitError: string | ApiErrorView | null;
  onSubmit: (values: JobFormValues) => Promise<void>;
};

function addOneHour(dateTimeLocal: string): string {
  const value = dateTimeLocal.trim();
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setHours(date.getHours() + 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}T${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

export function JobForm({
  selectedCustomer,
  defaultValues,
  submitLabel,
  submittingLabel,
  submitError,
  onSubmit,
}: JobFormProps) {
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: defaultValues ?? {
      customerId: "",
      title: "",
      serviceAddress: "",
      description: "",
      scheduledStartAt: "",
      scheduledEndAt: "",
    },
  });
  const [chosenCustomerOption, setChosenCustomerOption] =
    useState<CustomerSelectOption | null>(null);
  const selectedCustomerId = useWatch({ control, name: "customerId" });
  const autoEndTimeRef = useRef<string | null>(
    defaultValues?.scheduledStartAt && defaultValues.scheduledEndAt === addOneHour(defaultValues.scheduledStartAt)
      ? defaultValues.scheduledEndAt
      : null,
  );
  const startTimeField = register("scheduledStartAt");
  const endTimeField = register("scheduledEndAt");

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <FormSection
        title="Work order details"
        description="Define the customer, issue summary, and preferred schedule so assignment and workflow phases can build on a clean record."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="block space-y-2 md:col-span-2">
            <Controller
              name="customerId"
              control={control}
              render={({ field }) => (
                <CustomerSearchSelect
                  value={field.value}
                  selectedCustomer={chosenCustomerOption ?? selectedCustomer}
                  showCreateCustomerAction
                  onChange={(customerId, customer) => {
                    field.onChange(customerId);
                    setChosenCustomerOption(
                      customer
                        ? { id: customer.id, name: customer.name }
                        : null,
                    );
                  }}
                />
              )}
            />
            {errors.customerId ? (
              <p className="text-sm text-rose-600">{errors.customerId.message}</p>
            ) : null}
          </div>

          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Job title</span>
            <input
              {...register("title")}
              className={inputClassName}
              placeholder="Leaking kitchen tap"
            />
            {errors.title ? (
              <p className="text-sm text-rose-600">{errors.title.message}</p>
            ) : null}
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Service address</span>
            <textarea
              {...register("serviceAddress")}
              rows={3}
              className={textAreaClassName}
              placeholder="18 Collins Street, Melbourne VIC 3000"
            />
            {errors.serviceAddress ? (
              <p className="text-sm text-rose-600">{errors.serviceAddress.message}</p>
            ) : null}
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Description</span>
            <textarea
              {...register("description")}
              rows={4}
              className={textAreaClassName}
              placeholder="Describe the issue or requested work"
            />
            {errors.description ? (
              <p className="text-sm text-rose-600">{errors.description.message}</p>
            ) : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Start time</span>
            <input
              {...startTimeField}
              type="datetime-local"
              className={inputClassName}
              onChange={(event) => {
                startTimeField.onChange(event);

                const startValue = event.target.value;
                const currentEndValue = getValues("scheduledEndAt");

                if (!startValue) {
                  if (currentEndValue && currentEndValue === autoEndTimeRef.current) {
                    setValue("scheduledEndAt", "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }
                  autoEndTimeRef.current = null;
                  return;
                }

                const nextAutoEndValue = addOneHour(startValue);
                if (!nextAutoEndValue) {
                  return;
                }

                if (!currentEndValue || currentEndValue === autoEndTimeRef.current) {
                  setValue("scheduledEndAt", nextAutoEndValue, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  autoEndTimeRef.current = nextAutoEndValue;
                }
              }}
            />
            {errors.scheduledStartAt ? (
              <p className="text-sm text-rose-600">{errors.scheduledStartAt.message}</p>
            ) : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">End time</span>
            <input
              {...endTimeField}
              type="datetime-local"
              className={inputClassName}
              onChange={(event) => {
                endTimeField.onChange(event);
                if (event.target.value !== autoEndTimeRef.current) {
                  autoEndTimeRef.current = null;
                }
              }}
            />
            {errors.scheduledEndAt ? (
              <p className="text-sm text-rose-600">{errors.scheduledEndAt.message}</p>
            ) : null}
          </label>
        </div>
      </FormSection>

      <FormActions>
        <button
          type="submit"
          disabled={isSubmitting || !selectedCustomerId}
          className={primaryButtonClassName}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        {submitError ? <InlineErrorBanner message={submitError} /> : null}
      </FormActions>
    </form>
  );
}
