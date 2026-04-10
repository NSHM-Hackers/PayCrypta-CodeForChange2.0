import PaymentRequest from "../../models/PaymentRequest.js";
import User from "../../models/User.js";
import { sendSSEUpdate } from "../sse.js";

export const submitRequest = async (userId, recipientEmail, amount, note) => {
  // Validation
  if (!recipientEmail || amount === undefined || amount === null) {
    const error = new Error("Recipient email and amount are required");
    error.statusCode = 400;
    throw error;
  }

  if (amount <= 0) {
    const error = new Error("Amount must be greater than 0");
    error.statusCode = 400;
    throw error;
  }

  // Check recipient exists
  const recipient = await User.findOne({ email: recipientEmail });
  if (!recipient) {
    const error = new Error("Recipient not found");
    error.statusCode = 404;
    throw error;
  }

  // Prevent self request
  if (recipient._id.toString() === userId) {
    const error = new Error("Cannot request payment from yourself");
    error.statusCode = 400;
    throw error;
  }

  // Create payment request
  const paymentRequest = await PaymentRequest.create({
    requester: userId,
    recipientEmail,
    amount,
    note: note || "",
    status: "pending",
  });

  // Send SSE notification to recipient
  const requester = await User.findById(userId);
  sendSSEUpdate(
    recipient._id.toString(),
    {
      type: "payment_request_received",
      from: requester.name,
      fromEmail: requester.email,
      amount,
      note: note || "",
      requestId: paymentRequest._id,
      message: `${requester.name} requested ₹${amount}`,
    },
    "payment_request_received",
  ).catch((err) => {
    console.error(
      `[PaymentRequest] Failed to send SSE notification: ${err.message}`,
    );
  });

  return paymentRequest;
};
