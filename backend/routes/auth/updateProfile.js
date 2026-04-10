import User from "../../models/User.js";

export const updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
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
        return res.status(400).json({ msg: "Email already in use" });
      }
      user.email = normalizedEmail;
    }

    await user.save();

    return res.json({
      success: true,
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
    return res
      .status(500)
      .json({ msg: "Error updating profile", error: error.message });
  }
};
