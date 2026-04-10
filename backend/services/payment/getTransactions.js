import Transaction from "../../models/Transaction.js";

export const listUserTransactions = async (userId, queryParams = {}) => {
  const limit = Math.max(
    1,
    Math.min(Number.parseInt(queryParams.limit || 50, 10), 200),
  );
  const offset = Math.max(0, Number.parseInt(queryParams.offset || 0, 10));

  const query = { $or: [{ sender: userId }, { receiver: userId }] };

  const transactions = await Transaction.find(query)
    .populate("sender", "name email")
    .populate("receiver", "name email")
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);

  const total = await Transaction.countDocuments(query);

  const formattedTransactions = transactions.map((tx) => ({
    id: tx._id,
    type: tx.sender._id.toString() === userId ? "sent" : "received",
    amount: tx.amount,
    fromCurrency: tx.fromCurrency,
    convertedAmount: tx.convertedAmount,
    toCurrency: tx.toCurrency,
    from: tx.sender,
    to: tx.receiver,
    description: tx.description,
    status: tx.status,
    blockchainId: tx.blockchainId,
    isFraud: tx.isFraud,
    fraudReason: tx.fraudReason,
    date: tx.createdAt,
  }));

  return {
    transactions: formattedTransactions,
    total,
    limit,
    offset,
  };
};
