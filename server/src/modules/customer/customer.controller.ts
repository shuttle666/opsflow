import type { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error";
import { sendSuccess } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  createCustomerSchema,
  customerIdParamSchema,
  customerListQuerySchema,
  updateCustomerSchema,
} from "./customer-schemas";
import {
  createCustomer,
  getCustomerDetail,
  listCustomers,
  updateCustomer,
} from "./customer.service";

export const listCustomersHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const query = customerListQuerySchema.parse(req.query);
  const result = await listCustomers(req.auth, query);

  sendSuccess(res, {
    message: "Customers loaded.",
    data: result.items,
    meta: {
      pagination: result.pagination,
    },
  });
});

export const createCustomerHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const input = createCustomerSchema.parse(req.body);
  const result = await createCustomer(req.auth, input);

  sendSuccess(res, {
    statusCode: 201,
    message: "Customer created.",
    data: result,
  });
});

export const getCustomerDetailHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { customerId } = customerIdParamSchema.parse(req.params);
  const result = await getCustomerDetail(req.auth, customerId);

  sendSuccess(res, {
    message: "Customer loaded.",
    data: result,
  });
});

export const updateCustomerHandler: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.auth) {
    throw new ApiError(401, "Authentication is required.");
  }

  const { customerId } = customerIdParamSchema.parse(req.params);
  const input = updateCustomerSchema.parse(req.body);
  const result = await updateCustomer(req.auth, customerId, input);

  sendSuccess(res, {
    message: "Customer updated.",
    data: result,
  });
});
