import PaymentRequest from "../../models/PaymentRequest.js";
import User from "../../models/User.js";
import { sendSSEUpdate } from "../sse.js";

export const rejectRequest = async (userId, requestId) => {
  const paymentRequest = await PaymentRequest.findById(requestId);
  if (!paymentRequest) {
    const error = new Error("Payment request not found");
    error.statusCode = 404;
    throw error;
  }

  if (paymentRequest.status !== "pending") {
    const error = new Error(`Request is already ${paymentRequest.status}`);
    error.statusCode = 400;
    throw error;
  }

  const recipient = await User.findById(userId);
  const requester = await User.findById(paymentRequest.requester);

  if (!recipient || !requester) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (recipient.email !== paymentRequest.recipientEmail) {
    const error = new Error("You are not authorized to reject this request");
    error.statusCode = 403;
    throw error;
  }

  paymentRequest.status = "rejected";
  await paymentRequest.save();

  sendSSEUpdate(
    requester._id.toString(),
    {
      type: "payment_request_rejected",
      recipient: recipient.name,
      recipientEmail: recipient.email,
      amount: paymentRequest.amount,
      message: `${recipient.name} rejected your payment request of Rs${paymentRequest.amount}`,
    },
    "payment_request_rejected",
  ).catch((err) => {
    console.error(
      `[PaymentRequest] Failed to send rejection SSE to requester: ${err.message}`,
    );
  });

  sendSSEUpdate(
    recipient._id.toString(),
    {
      type: "payment_request_rejection_confirmed",
      requestId: paymentRequest._id,
      message: `Payment request of Rs${paymentRequest.amount} rejected`,
    },
    "payment_request_rejection_confirmed",
  ).catch((err) => {
    console.error(
      `[PaymentRequest] Failed to send rejection confirmation SSE: ${err.message}`,
    );
  });

  return {
    message: "Request rejected successfully",
    paymentRequest,
  };
};
