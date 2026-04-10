import mongoose from "mongoose";

const paymentRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientEmail: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    charge: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmountReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true },
);

export default mongoose.model("PaymentRequest", paymentRequestSchema);
