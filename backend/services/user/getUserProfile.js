import User from "../../models/User.js";
import KYC from "../../models/KYC.js";

export const getDetailedUserProfile = async (userId) => {
  const user = await User.findById(userId).select("-password_hash");
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const kyc = await KYC.findOne({ userId });

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    balance: user.balance,
    role: user.role,
    kycVerified: user.kycVerified,
    kycStatus: kyc ? kyc.status : "not_submitted",
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
