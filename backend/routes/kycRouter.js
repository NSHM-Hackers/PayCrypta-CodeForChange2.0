import express from "express";
import requireAuth from "../middlewares/auth.js";
import { submitUserKYC } from "../services/kyc/submitKYC.js";
import { getUserKYCStatus } from "../services/kyc/getKYCStatus.js";
import { getUserKYCDetails } from "../services/kyc/getKYCDetails.js";

export const submitKYC = async (req, res) => {
  try {
    const result = await submitUserKYC(req.user.id, req.body);
    return res.status(201).json({
      success: true,
      message: result.message,
      kyc: result.kyc,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("KYC submission error:", error);
    }

    const response = { msg: error.message };
    if (error.details) {
      response.details = error.details;
    }

    return res.status(statusCode).json(response);
  }
};

export const getKYCStatus = async (req, res) => {
  try {
    const result = await getUserKYCStatus(req.user.id);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("Get KYC status error:", error);
    }
    return res.status(statusCode).json({ msg: error.message });
  }
};

export const getKYCDetails = async (req, res) => {
  try {
    const kyc = await getUserKYCDetails(req.user.id);
    return res.json({
      success: true,
      kyc,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("Get KYC details error:", error);
    }
    return res.status(statusCode).json({ msg: error.message });
  }
};

const router = express.Router();

router.post("/submit", requireAuth, submitKYC);
router.get("/status", requireAuth, getKYCStatus);
router.get("/details", requireAuth, getKYCDetails);

export default router;
