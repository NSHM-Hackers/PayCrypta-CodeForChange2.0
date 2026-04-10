import express from "express";
import authRouter from "./authRouter.js";
import userRouter from "./userRouter.js";

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

router.use("/auth", authRouter);
router.use("/user", userRouter);

export default router;
