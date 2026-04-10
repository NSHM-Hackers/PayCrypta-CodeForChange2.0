import User from "../../models/User.js";

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password_hash");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Profile error:", error);
    return res.status(500).json({ msg: "Server error", error: error.message });
  }
};
