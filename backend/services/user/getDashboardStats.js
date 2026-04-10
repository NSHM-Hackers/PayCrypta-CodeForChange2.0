import User from "../../models/User.js";
import KYC from "../../models/KYC.js";
import Transaction from "../../models/Transaction.js";

export const getUserDashboardStats = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const kyc = await KYC.findOne({ userId });

  const allTransactions = await Transaction.find({
    $or: [{ sender: userId }, { receiver: userId }],
    status: "completed",
  });

  const totalTransactions = allTransactions.length;

  const currentDate = new Date();
  const startOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  );
  const endOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
    23,
    59,
    59,
  );

  const monthlyTransactions = allTransactions.filter((tx) => {
    const txDate = new Date(tx.createdAt);
    return txDate >= startOfMonth && txDate <= endOfMonth;
  });

  const monthlyIncome = monthlyTransactions
    .filter((tx) => tx.receiver && tx.receiver.toString() === userId.toString())
    .reduce((sum, tx) => sum + (tx.convertedAmount || 0), 0);

  const monthlyExpenses = monthlyTransactions
    .filter((tx) => tx.sender && tx.sender.toString() === userId.toString())
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  return {
    totalBalance: user.balance,
    monthlyIncome,
    monthlyExpenses,
    totalTransactions,
    monthlyTransactions: monthlyTransactions.length,
    kycVerified: user.kycVerified,
    kycStatus: kyc ? kyc.status : "not_submitted",
    accountStatus: user.isActive ? "active" : "inactive",
    memberSince: user.createdAt,
  };
};
