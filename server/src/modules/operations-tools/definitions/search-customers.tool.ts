import { z } from "zod";
import * as customerService from "../../customer/customer.service";
import type { OpsFlowTool } from "../tool-types";
import { customerSummarySchema, paginationSchema } from "./shared-schemas";

const inputSchema = z
  .object({
    q: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();
const outputSchema = z.object({
  customers: z.array(customerSummarySchema),
  pagination: paginationSchema,
});

export const searchCustomersTool: OpsFlowTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "search_customers",
  title: "Search customers",
  description: "Search active tenant-scoped customers by name, phone, or email.",
  audiences: ["web-agent", "external-mcp"],
  inputSchema,
  outputSchema,
  annotations: {
    readOnly: true,
    destructive: false,
    idempotent: true,
    openWorld: false,
  },
  conversationContext: "none",
  execute: async (auth, input) => {
    const result = await customerService.listCustomers(auth, {
      q: input.q,
      page: input.page,
      pageSize: input.pageSize,
      status: "active",
      sort: "createdAt_desc",
    });
    return { customers: result.items, pagination: result.pagination };
  },
};
