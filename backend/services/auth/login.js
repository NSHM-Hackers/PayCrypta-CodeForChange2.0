import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";

export const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error("email and password are required");
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const error = new Error("Invalid credentials");
    error.statusCode = 400;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error("Account deactivated. Please contact support.");
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const error = new Error("Invalid credentials");
    error.statusCode = 400;
    throw error;
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      balance: user.balance,
      kycVerified: user.kycVerified,
    },
  };
};
