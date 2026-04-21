import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required."),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateCustomerSchema = createCustomerSchema;

export const customerIdParamSchema = z.object({
  customerId: z.uuid(),
});

export const customerListQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["active", "archived", "all"]).default("active"),
  sort: z
    .enum(["createdAt_desc", "createdAt_asc", "name_asc", "name_desc"])
    .default("createdAt_desc"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerIdParamInput = z.infer<typeof customerIdParamSchema>;
export type CustomerListQueryInput = z.infer<typeof customerListQuerySchema>;
