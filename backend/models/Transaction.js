import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    charge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    fromCurrency: {
      type: String,
      default: "USD",
    },
    toCurrency: {
      type: String,
      default: "USD",
    },
    convertedAmount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "completed", "failed", "flagged"],
      default: "completed",
    },
    blockchainId: {
      type: String,
      default: null,
    },
    blockchainConfirmedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    isFraud: {
      type: Boolean,
      default: false,
    },
    fraudReason: {
      type: String,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Transaction", transactionSchema);
