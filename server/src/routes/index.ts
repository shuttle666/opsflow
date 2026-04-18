import { Router } from "express";
import { authRouter, invitationRouter, tenantRouter } from "../modules/auth/auth.routes";
import { auditRouter } from "../modules/audit/audit.routes";
import { customerRouter } from "../modules/customer/customer.routes";
import { jobRouter } from "../modules/job/job.routes";
import { membershipRouter } from "../modules/membership/membership.routes";
import { notificationRouter } from "../modules/notification/notification.routes";
import { agentRouter } from "../modules/agent/agent.routes";
import { healthRouter } from "./health.routes";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/tenants", tenantRouter);
router.use("/invitations", invitationRouter);
router.use("/activity", auditRouter);
router.use("/customers", customerRouter);
router.use("/jobs", jobRouter);
router.use("/memberships", membershipRouter);
router.use("/notifications", notificationRouter);
router.use("/agent", agentRouter);

export const apiRouter = router;
