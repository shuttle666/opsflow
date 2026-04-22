import type { JobStatus } from "@/types/job";

export type CustomerListQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
  status?: "active" | "archived" | "all";
  sort?: "createdAt_desc" | "createdAt_asc" | "name_asc" | "name_desc";
};

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerJobSummary = {
  id: string;
  title: string;
  serviceAddress: string;
  status: JobStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  assignedToName?: string;
};

export type CustomerDetail = CustomerListItem & {
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  };
  jobs: CustomerJobSummary[];
};

export type CreateCustomerInput = {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type UpdateCustomerInput = CreateCustomerInput;

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
