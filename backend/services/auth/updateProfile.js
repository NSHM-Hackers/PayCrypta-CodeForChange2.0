import User from "../../models/User.js";

export const updateUserProfile = async (userId, { name, email }) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (name) {
    user.name = name;
  }

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      const error = new Error("Email already in use");
      error.statusCode = 400;
      throw error;
    }

    user.email = normalizedEmail;
  }

  await user.save();

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    balance: user.balance,
    kycVerified: user.kycVerified,
  };
};
