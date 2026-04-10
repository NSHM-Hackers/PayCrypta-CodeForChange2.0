import express from "express";
import requireAuth from "../middlewares/auth.js";
import { submitRequest } from "../services/paymentRequest/submitRequest.js";
import { getMyRequests } from "../services/paymentRequest/getMyRequests.js";
import { getRequestsForMe } from "../services/paymentRequest/getRequestsForMe.js";
import { payRequest } from "../services/paymentRequest/payRequest.js";
import { rejectRequest } from "../services/paymentRequest/rejectRequest.js";

const router = express.Router();

// Create payment request
router.post("/create", requireAuth, async (req, res) => {
  try {
    const { recipientEmail, amount, note } = req.body;
    const result = await submitRequest(
      req.user.id,
      recipientEmail,
      amount,
      note,
    );

    res.status(201).json({
      message: "Payment request sent successfully",
      request: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(`[PaymentRequest] Error creating request: ${error.message}`);
    res.status(statusCode).json({ message: error.message });
  }
});

// Get my sent requests
router.get("/sent", requireAuth, async (req, res) => {
  try {
    const requests = await getMyRequests(req.user.id);

    res.json({
      message: "Sent requests retrieved",
      requests,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(
      `[PaymentRequest] Error fetching sent requests: ${error.message}`,
    );
    res.status(statusCode).json({ message: error.message });
  }
});

// Get requests received for me
router.get("/received", requireAuth, async (req, res) => {
  try {
    const requests = await getRequestsForMe(req.user.id);

    res.json({
      message: "Received requests retrieved",
      requests,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(
      `[PaymentRequest] Error fetching received requests: ${error.message}`,
    );
    res.status(statusCode).json({ message: error.message });
  }
});

// Pay a request
router.post("/pay/:id", requireAuth, async (req, res) => {
  try {
    const result = await payRequest(req.user.id, req.params.id);

    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(`[PaymentRequest] Error paying request: ${error.message}`);
    res.status(statusCode).json({ message: error.message });
  }
});

// Reject a request
router.post("/reject/:id", requireAuth, async (req, res) => {
  try {
    const result = await rejectRequest(req.user.id, req.params.id);

    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(`[PaymentRequest] Error rejecting request: ${error.message}`);
    res.status(statusCode).json({ message: error.message });
  }
});

export default router;
