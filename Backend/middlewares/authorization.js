const jwt = require("jsonwebtoken");
const { default: mongoose } = require("mongoose");
const { useImperativeHandle } = require("react");
const token = require("../models/token");
async function authorizeUserPostRequest(req, res, next) {
  // authorizing user post requests to make sure the user itself only can make the request
  const API = process.env.API_URL;
  if (req.method !== "POST") return next();
  if (req.originalUrl.startsWith(`${API}/admin`)) return next();

  // exclude some auth routes
  const endPoints = [
    // public routes that don't require authentication
    `/${apiUrl}/login`,
    `/${apiUrl}/forgotPassword`,
    `/${apiUrl}/resetPassword`,
    `/${apiUrl}/verifyOtp`,
    `/${apiUrl}/register`,
    `/${apiUrl}/verifyToken`,
  ];
  const isOneOfTheEndPoints = endPoints.some((endpoint) =>
    req.originalUrl.includes(endpoint)
  );
  if (isOneOfTheEndPoints) return next();

  const authHeader = req.header("Authorization");
  if (!authHeader) return next();

  // find the userId from the access token
  const accessToken = authHeader.replace("Bearer", "").trim();
  const tokenData = jwt.decode(accessToken);

  if (req.body.user && req.body.user !== tokenData.id) {
    return res.status(401).json({
      message:
        "User conflict!\n The user making the request doesn't match the user in the request",
    });
  } else if (/\/users\/([^/]+)\//.test(req.originalUrl)) {
    const parts = req.originalUrl.split("/");
    const userIndex = parts.indexOf("users");

    const id = parts(userIndex + 1);
    if (!mongoose.isValidObjectId(id)) return next();
    if (tokenData.id !== id)
      return res.status(401).json({
        message:
          "User conflict!\n The user making the request doesn't match the user in the request",
      });
  }
  return next();
}
module.exports = authorizeUserPostRequest;
