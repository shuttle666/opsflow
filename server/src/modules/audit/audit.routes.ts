import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireTenantAccess } from "../../middleware/require-tenant-access";
import { listActivityFeedHandler } from "./audit.controller";

const auditRouter = Router();

auditRouter.use(authenticate, requireTenantAccess);
auditRouter.get("/", listActivityFeedHandler);

export { auditRouter };
