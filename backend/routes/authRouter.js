import express from "express";
import requireAuth from "../middlewares/auth.js";
import { registerUser } from "../services/auth/register.js";
import { loginUser } from "../services/auth/login.js";
import { getUserProfile } from "../services/auth/getProfile.js";
import { updateUserProfile } from "../services/auth/updateProfile.js";

export const register = async (req, res) => {
  try {
    const result = await registerUser(req.body);

    return res.status(201).json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("Register error:", error);
    }
    return res.status(statusCode).json({ msg: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const result = await loginUser(req.body);

    return res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("Login error:", error);
    }
    return res.status(statusCode).json({ msg: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await getUserProfile(req.user.id);
    return res.json(user);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode === 500) {
      console.error("Profile error:", error);
    }
    return res.status(statusCode).json({ msg: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await updateUserProfile(req.user.id, req.body);

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ msg: error.message });
  }
};

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", requireAuth, getProfile);
router.put("/profile", requireAuth, updateProfile);

export default router;
