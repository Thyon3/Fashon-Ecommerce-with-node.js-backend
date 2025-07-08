const jwt = require("jsonwebtoken");
const UserModel = require("../models/user");

async function errorHandler(error, req, res, next) {
  try {
    if (error.name === "UnauthorizedEror") {
      if (!error.message.includes("jwt expired")) {
        return res.status(error.status).json({
          type: error.name,
          message: error.message,
        });
      }
      // now it means the accessToken is expired so let's use refresh token to refresh the access token
      const tokenHeader = req.header("Authorization");
      const accessToken = tokenHeader.replace("Bearer", "").trim();
      const token = await TokenModel.findOne({
        accessToken: accessToken,
        refreshToken: { $exists: true },
      });

      if (!token) {
        return res.status(401).json({
          type: "unatuthorized",
          message: " You are not authorized to access this resource",
        });
      }

      const tokenData = jwt.verify(
        token.refreshToken,
        process.env.REFRESH_TOKEN_SECRETSTRING
      );

      // find the user with the id in the token
      const user = await UserModel.findById(tokenData.id);
      if (!user) {
        return res.status(401).json({
          type: "unatuthorized",
          message: " You are not authorized to access this resource",
        });
      }
      // the user exists so create the new access token
      const newAccessToken = jwt.sign(
        {
          id: user._id,
          isAdmin: user.isAdmin,
        },
        process.env.ACCESS_TOKEN_SECRETSTRING,
        { expiresIn: "24h" }
      );
      req.header("Authorization") = `Bearer${newAccessToken}`; 
      // save the token 
      await TokenModel.updateOne({_id: token.id},{accessToken: newAccessToken}).exec();
      res.set('Authorization',`Bearer${newAccessToken}`);
      return next(); 
    }
  } catch (error) {
    return res.status(500).json({ type: error.name, message: error.message });
  }
  return res.status(error.status).json({
          type: error.name,
          message: error.message,
        });
}

module.exports = errorHandler; 
