import express from "express";
import requireAuth from "../middlewares/auth.js";
import { sseRoute } from "../services/sse.js";
import authRouter from "./authRouter.js";
import userRouter from "./userRouter.js";
import kycRouter from "./kycRouter.js";

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// SSE endpoint for sending updates on events like KYC status changes, transaction updates, etc.
router.get("/sseupdates", requireAuth, sseRoute);

router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/kyc", kycRouter);

export default router;
