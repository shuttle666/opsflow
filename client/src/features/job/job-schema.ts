import { z } from "zod";

export const jobFormSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required"),
  title: z.string().trim().min(1, "Job title is required"),
  serviceAddress: z.string().trim().min(1, "Service address is required").max(500),
  description: z.string().trim().optional(),
  scheduledStartAt: z.string().trim().optional(),
  scheduledEndAt: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  const start = value.scheduledStartAt?.trim();
  const end = value.scheduledEndAt?.trim();

  if ((start && !end) || (!start && end)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [start ? "scheduledEndAt" : "scheduledStartAt"],
      message: "Both start and end time are required.",
    });
    return;
  }

  if (start && end && new Date(end) <= new Date(start)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scheduledEndAt"],
      message: "End time must be after the start time.",
    });
  }
});

export type JobFormValues = z.infer<typeof jobFormSchema>;
