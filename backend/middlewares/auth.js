import jwt from "jsonwebtoken";

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    return next();
  } catch (error) {
    return res.status(401).json({ msg: "Token is not valid" });
  }
};

export default requireAuth;
