import { z } from "zod";
import * as customerService from "../../customer/customer.service";
import type { OpsFlowTool } from "../tool-types";
import { customerSummarySchema } from "./shared-schemas";

const inputSchema = z.object({ customerId: z.uuid() }).strict();
const outputSchema = z.object({
  customer: customerSummarySchema.extend({
    createdBy: z.object({
      id: z.string(),
      displayName: z.string(),
      email: z.string(),
    }),
    jobs: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        serviceAddress: z.string(),
        status: z.string(),
        scheduledStartAt: z.date().nullable(),
        scheduledEndAt: z.date().nullable(),
        assignedToName: z.string().optional(),
      }),
    ),
  }),
});

export const getCustomerTool: OpsFlowTool<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: "get_customer",
  title: "Get customer",
  description: "Get tenant-scoped customer detail and recent jobs by resolved ID.",
  audiences: ["web-agent", "external-mcp"],
  inputSchema,
  outputSchema,
  annotations: {
    readOnly: true,
    destructive: false,
    idempotent: true,
    openWorld: false,
  },
  execute: async (auth, input) => ({
    customer: await customerService.getCustomerDetail(auth, input.customerId),
  }),
};
