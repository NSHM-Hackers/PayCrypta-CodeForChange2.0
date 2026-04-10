import KYC from "../../models/KYC.js";
import User from "../../models/User.js";

export const getUserKYCStatus = async (userId) => {
  const user = await User.findById(userId).select("kycVerified");
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const kyc = await KYC.findOne({ userId }).sort({ createdAt: -1 });

  let status = "not_submitted";
  let kycDetails = null;

  if (user.kycVerified) {
    status = "approved";
  } else if (kyc) {
    status = kyc.status;
    kycDetails = {
      submittedAt: kyc.submittedAt,
      documentType: kyc.documentType,
      status: kyc.status,
      remarks: kyc.remarks,
    };
  }

  return {
    status,
    kycVerified: user.kycVerified,
    kycDetails,
  };
};
