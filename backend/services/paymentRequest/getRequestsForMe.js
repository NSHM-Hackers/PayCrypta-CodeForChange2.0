import PaymentRequest from "../../models/PaymentRequest.js";
import User from "../../models/User.js";

export const getRequestsForMe = async (userId) => {
  // Get user's email
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const requests = await PaymentRequest.find({
    recipientEmail: user.email,
  })
    .populate("requester", "name email")
    .sort({ createdAt: -1 });

  return requests;
};
