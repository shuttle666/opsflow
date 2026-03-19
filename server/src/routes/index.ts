import { Router } from "express";
import { authRouter, invitationRouter, tenantRouter } from "../modules/auth/auth.routes";
import { healthRouter } from "./health.routes";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/tenants", tenantRouter);
router.use("/invitations", invitationRouter);

export const apiRouter = router;
