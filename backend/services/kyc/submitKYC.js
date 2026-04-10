import KYC from "../../models/KYC.js";

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

  return {
    message: "KYC submitted successfully! It will be reviewed manually.",
    kyc,
  };
};
