import PaymentRequest from "../../models/PaymentRequest.js";
import User from "../../models/User.js";
import { sendSSEUpdate } from "../sse.js";

export const payRequest = async (userId, requestId) => {
  // Find payment request
  const paymentRequest = await PaymentRequest.findById(requestId);
  if (!paymentRequest) {
    const error = new Error("Payment request not found");
    error.statusCode = 404;
    throw error;
  }

  // Check if already paid or rejected
  if (paymentRequest.status !== "pending") {
    const error = new Error(`Request is already ${paymentRequest.status}`);
    error.statusCode = 400;
    throw error;
  }

  // Get payer and requester
  const payer = await User.findById(userId);
  const requester = await User.findById(paymentRequest.requester);

  if (!payer || !requester) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  // Check balance
  if (payer.balance < paymentRequest.amount) {
    const error = new Error("Insufficient balance");
    error.statusCode = 400;
    throw error;
  }

  // Update balances
  payer.balance -= paymentRequest.amount;
  requester.balance += paymentRequest.amount;

  // Mark request as paid
  paymentRequest.status = "paid";

  // Save all changes
  await payer.save();
  await requester.save();
  await paymentRequest.save();

  // Send SSE notifications
  // Notify requester that payment was received
  sendSSEUpdate(
    requester._id.toString(),
    {
      type: "payment_request_paid",
      from: payer.name,
      fromEmail: payer.email,
      amount: paymentRequest.amount,
      message: `${payer.name} paid your payment request of ₹${paymentRequest.amount}`,
    },
    "payment_request_paid",
  ).catch((err) => {
    console.error(
      `[PaymentRequest] Failed to send SSE to requester: ${err.message}`,
    );
  });

  // Notify payer confirmation
  sendSSEUpdate(
    payer._id.toString(),
    {
      type: "payment_request_confirmed",
      to: requester.name,
      toEmail: requester.email,
      amount: paymentRequest.amount,
      message: `Payment request of ₹${paymentRequest.amount} to ${requester.name} confirmed`,
    },
    "payment_request_confirmed",
  ).catch((err) => {
    console.error(
      `[PaymentRequest] Failed to send SSE to payer: ${err.message}`,
    );
  });

  return {
    message: "Payment successful",
    paymentRequest,
  };
};
