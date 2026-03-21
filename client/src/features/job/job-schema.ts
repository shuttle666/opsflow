import { z } from "zod";

export const jobFormSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required"),
  title: z.string().trim().min(1, "Job title is required"),
  description: z.string().trim().optional(),
  scheduledAt: z.string().trim().optional(),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;
