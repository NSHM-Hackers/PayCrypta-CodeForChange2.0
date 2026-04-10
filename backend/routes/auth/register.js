import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ msg: "name, email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const role = "user";

    const user = await User.create({
      name,
      email: normalizedEmail,
      password_hash,
      role,
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        balance: user.balance,
        kycVerified: user.kycVerified,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res
      .status(500)
      .json({ msg: "Register error", error: error.message });
  }
};
