import express from "express";
import authRouter from "./auth/authRouter.js";

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

router.use("/auth", authRouter);

export default router;
