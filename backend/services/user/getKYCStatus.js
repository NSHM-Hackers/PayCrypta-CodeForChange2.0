import User from "../../models/User.js";
import KYC from "../../models/KYC.js";

export const getUserKYCStatus = async (userId) => {
  const user = await User.findById(userId).select("kycVerified");
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const kyc = await KYC.findOne({ userId });

  let status = "not_submitted";
  if (kyc) {
    status = kyc.status;
  } else if (user.kycVerified) {
    status = "approved";
  }

  return {
    status,
    kycVerified: user.kycVerified,
    kycDetails: kyc || null,
  };
};
