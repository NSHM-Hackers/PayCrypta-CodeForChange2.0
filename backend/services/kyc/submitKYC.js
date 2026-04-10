import KYC from "../../models/KYC.js";
import User from "../../models/User.js";
import { sendSSEUpdate } from "../sse.js";

const AUTO_VERIFY_DELAY_MS = Number(
  process.env.KYC_AUTO_VERIFY_DELAY_MS || 10000,
);

const scheduleAutoVerifyKYC = (kycId, userId) => {
  setTimeout(async () => {
    try {
      const kyc = await KYC.findById(kycId);

      // Skip if this request has already been handled by another flow.
      if (!kyc || kyc.status !== "pending") {
        return;
      }

      kyc.status = "approved";
      kyc.remarks = "Auto-verified by system";
      kyc.reviewedAt = new Date();
      await kyc.save();

      await User.findByIdAndUpdate(userId, { kycVerified: true });

      sendSSEUpdate(
        userId.toString(),
        {
          type: "kyc_status_updated",
          status: "approved",
          kycId: kyc._id,
          reviewedAt: kyc.reviewedAt,
          remarks: kyc.remarks,
        },
        "kyc_status_updated",
      );
    } catch (error) {
      console.error("Auto KYC verification error:", error);
    }
  }, AUTO_VERIFY_DELAY_MS);
};

export const submitUserKYC = async (userId, payload) => {
  const { fullName, documentType, documentNumber, documentImage } = payload;

  if (!fullName || !documentType || !documentNumber || !documentImage) {
    const error = new Error(
      "fullName, documentType, documentNumber and documentImage are required",
    );
    error.statusCode = 400;
    throw error;
  }

  const existingKYC = await KYC.findOne({ userId });
  if (existingKYC) {
    const error = new Error("KYC already submitted");
    error.statusCode = 400;
    error.details = { status: existingKYC.status };
    throw error;
  }

  const kyc = await KYC.create({
    userId,
    fullName,
    documentType,
    documentNumber,
    documentImage,
    status: "pending",
  });

  // Fire-and-forget delayed auto verification so the API can respond immediately.
  scheduleAutoVerifyKYC(kyc._id, userId);

  return {
    message: "KYC submitted successfully! Verification is in progress.",
    kyc,
  };
};
