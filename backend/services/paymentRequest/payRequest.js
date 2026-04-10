import PaymentRequest from "../../models/PaymentRequest.js";
import Transaction from "../../models/Transaction.js";
import User from "../../models/User.js";
import { sendSSEUpdate } from "../sse.js";

const PAYMENT_REQUEST_CHARGE_RATE = 0.03;

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

  if (payer.email !== paymentRequest.recipientEmail) {
    const error = new Error("You are not authorized to pay this request");
    error.statusCode = 403;
    throw error;
  }

  // Check balance
  if (payer.balance < paymentRequest.amount) {
    const error = new Error("Insufficient balance");
    error.statusCode = 400;
    throw error;
  }

  const charge = Number(
    (paymentRequest.amount * PAYMENT_REQUEST_CHARGE_RATE).toFixed(2),
  );
  const netAmountReceived = Number((paymentRequest.amount - charge).toFixed(2));

  // Update balances
  payer.balance -= paymentRequest.amount;
  requester.balance += netAmountReceived;

  // Mark request as paid
  paymentRequest.status = "paid";
  paymentRequest.charge = charge;
  paymentRequest.netAmountReceived = netAmountReceived;

  const transaction = await Transaction.create({
    sender: payer._id,
    receiver: requester._id,
    amount: paymentRequest.amount,
    charge,
    fromCurrency: "INR",
    toCurrency: "INR",
    convertedAmount: netAmountReceived,
    description: paymentRequest.note || "Payment request payment",
    status: "completed",
    isFraud: false,
  });

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
      amount: netAmountReceived,
      requestedAmount: paymentRequest.amount,
      charge,
      message: `${payer.name} paid your request of ₹${paymentRequest.amount}. Charge: ₹${charge}, received: ₹${netAmountReceived}`,
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
      charge,
      netAmountReceived,
      message: `Payment request of ₹${paymentRequest.amount} to ${requester.name} confirmed (charge: ₹${charge}, recipient receives: ₹${netAmountReceived})`,
    },
    "payment_request_confirmed",
  ).catch((err) => {
    console.error(
      `[PaymentRequest] Failed to send SSE to payer: ${err.message}`,
    );
  });

  return {
    message: "Payment successful",
    charge,
    netAmountReceived,
    transactionId: transaction._id,
    paymentRequest,
  };
};
