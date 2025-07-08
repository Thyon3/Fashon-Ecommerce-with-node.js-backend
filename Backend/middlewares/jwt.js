const { expressjwt: jwtMiddleware } = require("express-jwt");
const TokenModel = require("../models/token");

function jwtAuthentication() {
  apiUrl = process.env.API_URL;
  return jwtMiddleware({
    secret: process.env.ACCESS_TOKEN_SECRETSTRING,
    algorithms: ["HS256"],
    isRevoked: isRevoked,
  }).unless({
    path: [
      // public routes that don't require authentication
      `/${apiUrl}/login`,
      `/${apiUrl}/login/`,

      `/${apiUrl}/forgotPassword`,
      `/${apiUrl}/forgotPassword/`,

      `/${apiUrl}/resetPassword`,
      `/${apiUrl}/resetPassword/`,

      `/${apiUrl}/verifyOtp`,
      `/${apiUrl}/verifyOtp/`,

      `/${apiUrl}/register`,
      `/${apiUrl}/register/`,
      `/${apiUrl}/verifyToken`,
    ],
  });
}

async function isRevoked(req, jwt) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return true; // Token is missing or malformed
  }
  const accessToken = authHeader.replace("Bearer", "").trim();

  const token = await TokenModel.findOne({ accessToken });

  const adminRouteRegx = /^\/api\/v1\/admin\//i;

  const adminFault =
    !jwt.payload.isAdmin && adminRouteRegx.test(req.originalUrl);
  return !token || adminFault; // If token exists, return false (not revoked), else return true if admin route is accessed by non-admin user
}

module.exports = jwtAuthentication;
