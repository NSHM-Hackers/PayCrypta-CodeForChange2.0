import crypto from "crypto";
import axios from "axios";
import mongoose from "mongoose";
import Transaction from "../../models/Transaction.js";
import User from "../../models/User.js";
import { getExchangeRate } from "../../utils/exchangeRate.js";
import detectFraud from "../../utils/fraudDetection.js";
import { sendSSEUpdate } from "../sse.js";

const BLOCKCHAIN_SERVICE_URL =
  process.env.BLOCKCHAIN_SERVICE_URL || "http://127.0.0.1:5071";

const toNumber = (value) => Number(value);

const generateTransactionHash = (
  transactionId,
  senderId,
  receiverId,
  amount,
  timestamp,
) => {
  const rawData = `${transactionId}-${senderId}-${receiverId}-${amount}-${timestamp}`;
  return crypto.createHash("sha256").update(rawData).digest("hex");
};

const getConversionRate = async (fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  if (fromCurrency === "INR") {
    return getExchangeRate(toCurrency);
  }

  if (toCurrency === "INR") {
    const fromRate = await getExchangeRate(fromCurrency);
    return 1 / fromRate;
  }

  const [fromRate, toRate] = await Promise.all([
    getExchangeRate(fromCurrency),
    getExchangeRate(toCurrency),
  ]);

  return toRate / fromRate;
};

const processBlockchainVerification = async (
  transactionId,
  senderId,
  receiverId,
) => {
  try {
    const tx = await Transaction.findById(transactionId);
    if (!tx || tx.status !== "pending") {
      return;
    }

    const transactionHash = generateTransactionHash(
      tx._id.toString(),
      senderId,
      receiverId,
      tx.amount,
      tx.createdAt.getTime(),
    );

    const flaskResponse = await axios.post(
      `${BLOCKCHAIN_SERVICE_URL}/record-transaction`,
      {
        hash: transactionHash,
        localTxId: tx._id.toString(),
      },
      { timeout: 30000 },
    );

    const blockchainId = flaskResponse.data.blockchain_id;

    await Transaction.findByIdAndUpdate(tx._id, {
      status: "verified",
      blockchainId,
      blockchainConfirmedAt: new Date(),
      failureReason: null,
    });

    sendSSEUpdate(
      senderId,
      {
        type: "transaction_status_updated",
        txId: tx._id,
        blockchainId,
        status: "verified",
      },
      "transaction_status_updated",
    );

    sendSSEUpdate(
      receiverId,
      {
        type: "transaction_received",
        txId: tx._id,
        blockchainId,
        status: "verified",
      },
      "transaction_received",
    );
  } catch (error) {
    const tx = await Transaction.findById(transactionId);
    if (!tx) {
      return;
    }

    if (tx.status === "pending") {
      await Transaction.findByIdAndUpdate(tx._id, {
        status: "failed",
        failureReason: error.message,
      });

      await User.findByIdAndUpdate(senderId, { $inc: { balance: tx.amount } });
      await User.findByIdAndUpdate(receiverId, {
        $inc: { balance: -tx.convertedAmount },
      });
    }

    sendSSEUpdate(
      senderId,
      {
        type: "transaction_status_updated",
        txId: tx._id,
        status: "failed",
        error: "Blockchain verification failed. Balance has been reversed.",
      },
      "transaction_status_updated",
    );
  }
};

export const createTransfer = async (senderId, payload) => {
  const {
    receiver,
    amount,
    fromCurrency = "USD",
    toCurrency = "USD",
    description,
  } = payload;

  const numericAmount = toNumber(amount);
  if (!receiver || Number.isNaN(numericAmount) || numericAmount <= 0) {
    const error = new Error("Invalid transfer details");
    error.statusCode = 400;
    throw error;
  }

  const senderUser = await User.findById(senderId);
  if (!senderUser) {
    const error = new Error("Sender not found");
    error.statusCode = 404;
    throw error;
  }

  let receiverUser = null;
  if (mongoose.Types.ObjectId.isValid(receiver)) {
    receiverUser = await User.findById(receiver);
  }
  if (!receiverUser) {
    receiverUser = await User.findOne({ email: receiver });
  }

  if (!receiverUser) {
    const error = new Error("Receiver not found");
    error.statusCode = 404;
    throw error;
  }

  if (senderId === receiverUser._id.toString()) {
    const error = new Error("Cannot send money to yourself");
    error.statusCode = 400;
    throw error;
  }

  if (senderUser.balance < numericAmount) {
    const error = new Error("Insufficient balance");
    error.statusCode = 400;
    throw error;
  }

  const rate = await getConversionRate(fromCurrency, toCurrency);
  const convertedAmount = Number((numericAmount * rate).toFixed(2));

  const isFraud = detectFraud(numericAmount);

  const transaction = await Transaction.create({
    sender: senderId,
    receiver: receiverUser._id,
    amount: numericAmount,
    fromCurrency,
    toCurrency,
    convertedAmount,
    description: description || "Transfer",
    status: isFraud ? "flagged" : "pending",
    isFraud,
    fraudReason: isFraud ? "Amount exceeds limit" : null,
  });

  if (!isFraud) {
    await User.findByIdAndUpdate(senderId, {
      $inc: { balance: -numericAmount },
    });
    await User.findByIdAndUpdate(receiverUser._id, {
      $inc: { balance: convertedAmount },
    });
  }

  const populated = await Transaction.findById(transaction._id)
    .populate("sender", "name email")
    .populate("receiver", "name email");

  if (!isFraud) {
    processBlockchainVerification(
      transaction._id.toString(),
      senderId,
      receiverUser._id.toString(),
    ).catch((error) => {
      console.error("Error in background blockchain processing:", error);
    });
  }

  return {
    transaction: {
      id: populated._id,
      from: populated.sender,
      to: populated.receiver,
      amount: populated.amount,
      fromCurrency: populated.fromCurrency,
      convertedAmount: populated.convertedAmount,
      toCurrency: populated.toCurrency,
      description: populated.description,
      status: populated.status,
      isFraud: populated.isFraud,
      fraudReason: populated.fraudReason,
      blockchainId: populated.blockchainId,
      date: populated.createdAt,
    },
    message: isFraud
      ? "Transaction flagged for review"
      : "Transfer initiated. Processing blockchain verification...",
    isFraud,
  };
};
