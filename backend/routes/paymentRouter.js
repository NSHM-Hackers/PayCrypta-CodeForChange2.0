import express from "express";
import requireAuth from "../middlewares/auth.js";
import { createTransfer } from "../services/payment/transfer.js";
import { listUserTransactions } from "../services/payment/getTransactions.js";

export const transfer = async (req, res) => {
  try {
    const result = await createTransfer(req.user.id, req.body);
    return res.status(202).json({
      success: true,
      transaction: result.transaction,
      message: result.message,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("Transfer error:", error);
    }
    return res.status(statusCode).json({ msg: error.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const result = await listUserTransactions(req.user.id, req.query);
    return res.json({
      success: true,
      transactions: result.transactions,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return res.status(500).json({ msg: "Error fetching transactions" });
  }
};

const router = express.Router();

router.post("/transfer", requireAuth, transfer);
router.get("/history", requireAuth, getTransactions);

export default router;
