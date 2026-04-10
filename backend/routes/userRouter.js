import express from "express";
import requireAuth from "../middlewares/auth.js";
import { getCurrentUser } from "../services/user/getUser.js";
import { getDetailedUserProfile } from "../services/user/getUserProfile.js";
import { getUserDashboardStats } from "../services/user/getDashboardStats.js";
import { getUserKYCStatus } from "../services/user/getKYCStatus.js";

export const getUser = async (req, res) => {
  try {
    const user = await getCurrentUser(req.user.id);
    return res.json(user);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("Get user error:", error);
    }
    return res.status(statusCode).json({ msg: error.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const profile = await getDetailedUserProfile(req.user.id);
    return res.json(profile);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("Get profile error:", error);
    }
    return res.status(statusCode).json({ msg: error.message });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const stats = await getUserDashboardStats(req.user.id);
    return res.json(stats);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("Get stats error:", error);
    }
    return res.status(statusCode).json({ msg: error.message });
  }
};

export const getKYCStatus = async (req, res) => {
  try {
    const status = await getUserKYCStatus(req.user.id);
    return res.json(status);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("Get KYC status error:", error);
    }
    return res.status(statusCode).json({ msg: error.message });
  }
};

const router = express.Router();

router.get("/me", requireAuth, getUser);
router.get("/profile", requireAuth, getUserProfile);
router.get("/stats", requireAuth, getDashboardStats);
router.get("/kyc-status", requireAuth, getKYCStatus);

export default router;
