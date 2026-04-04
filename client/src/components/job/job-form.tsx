"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { FormActions, FormSection } from "@/components/ui/form-surface";
import {
  inputClassName,
  primaryButtonClassName,
  selectClassName,
  textAreaClassName,
} from "@/components/ui/styles";
import { jobFormSchema, type JobFormValues } from "@/features/job/job-schema";
import type { CustomerListItem } from "@/types/customer";

type JobFormProps = {
  customers: CustomerListItem[];
  defaultValues?: JobFormValues;
  submitLabel: string;
  submittingLabel: string;
  submitError: string | null;
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
  customers,
  defaultValues,
  submitLabel,
  submittingLabel,
  submitError,
  onSubmit,
}: JobFormProps) {
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: defaultValues ?? {
      customerId: "",
      title: "",
      description: "",
      scheduledStartAt: "",
      scheduledEndAt: "",
    },
  });
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
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Customer</span>
            <select {...register("customerId")} className={selectClassName}>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            {errors.customerId ? (
              <p className="text-sm text-rose-600">{errors.customerId.message}</p>
            ) : null}
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Job title</span>
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
            <span className="text-sm font-medium text-slate-700">Description</span>
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
            <span className="text-sm font-medium text-slate-700">Start time</span>
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
            <span className="text-sm font-medium text-slate-700">End time</span>
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
          disabled={isSubmitting || customers.length === 0}
          className={primaryButtonClassName}
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        {submitError ? <p className="text-sm text-rose-600">{submitError}</p> : null}
      </FormActions>
    </form>
  );
}
