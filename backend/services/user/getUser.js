import User from "../../models/User.js";

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).select("-password_hash");
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  return user;
};
