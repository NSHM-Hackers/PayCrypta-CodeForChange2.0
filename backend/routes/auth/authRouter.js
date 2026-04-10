import express from "express";
import { register } from "./register.js";
import { login } from "./login.js";
import { getProfile } from "./getProfile.js";
import { updateProfile } from "./updateProfile.js";
import requireAuth from "../../middlewares/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", requireAuth, getProfile);
router.put("/profile", requireAuth, updateProfile);

export default router;
