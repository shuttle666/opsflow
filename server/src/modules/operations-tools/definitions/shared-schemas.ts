import { JobStatus } from "@prisma/client";
import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const jobSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  serviceAddress: z.string(),
  status: z.nativeEnum(JobStatus),
  scheduledStartAt: z.date().nullable(),
  scheduledEndAt: z.date().nullable(),
  customer: z.object({ id: z.string(), name: z.string() }),
  assignedToName: z.string().optional(),
});

export const customerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
