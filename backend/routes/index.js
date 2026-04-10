import express from "express";
import authRouter from "./authRouter.js";
import userRouter from "./userRouter.js";
import kycRouter from "./kycRouter.js";

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/kyc", kycRouter);

export default router;
