import KYC from "../../models/KYC.js";

export const getUserKYCDetails = async (userId) => {
  const kyc = await KYC.findOne({ userId }).sort({ createdAt: -1 });

  if (!kyc) {
    const error = new Error("No KYC submission found");
    error.statusCode = 404;
    throw error;
  }

  return kyc;
};
