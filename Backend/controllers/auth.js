//import validation result from express validator
const bcrypt = require("bcrypt");
const emailSender = require("../heplers/email_sender");
const UserModel = require("../models/user");
const TokenModel = require("../models/token");
const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");

// registering users
exports.register = async function (req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    }));
    return res.status(400).json({ error: errorMessages });
  }

  try {
    let newUser = new UserModel({
      ...req.body,
      passwordHash: bcrypt.hashSync(req.body.password, 8),
    });

    let user = await newUser.save();
    // send an error message if saving the user is not successfull
    if (!user) {
      return res.json({
        type: "Internal Server Error ",
        message: "could not save the new user",
      });
    }
    //if we reach this level it means we ahve saved teh user successfully
    return res.status(201).json(user);
  } catch (error) {
    //instead of showing the orginal error message use this one for a duplicated email
    if (error.message.includes("email_1 dup key")) {
      return res.status(409).json({
        type: "Auth Error",
        message: "A user with this email already exist",
      });
    }
    return res.status(500).json({
      type: error.name,
      messge: error.msg,
    });
  }
};

//logging users in
exports.login = async function (req, res, next) {
  try {
    // extract the email and the password from the request body
    const { email, password } = req.body;
    // find a user with the email

    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "A user is not found \n check your email again" });
    }
    if (!bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(400).json({ message: "password is incorrect" });
    }
    //the user is legit
    // define the access and referesh tokens

    const accessToken = jwt.sign(
      {
        id: user.id,
        isAdmin: user.isAdmin,
      },
      process.env.ACCESS_TOKEN_SECRETSTRING,
      { expiresIn: "24h" }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRETSTRING,
      {
        expiresIn: "60d",
      }
    );

    // check if the token already exists or not
    const token = await TokenModel.findOne({ userId: user.id });

    if (token) {
      await token.deleteOne();
    }

    const newToken = await new TokenModel({
      userId: user.id,
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
    await newToken.save();

    user.passwordHash = undefined;
    return res.json({
      ...user._doc,
      accessToken,
    });
  } catch (error) {
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// verify tokens
exports.verifyToken = async function (req, res, next) {
  try {
    // access the access token from the request header

    let accessToken = req.headers.authorization;
    if (!accessToken) {
      return res.json(false);
    }
    accessToken = accessToken.replace("Bearer", "").trim();

    // find the refresh token with the same acces token
    let token = await TokenModel.findOne({ accessToken: accessToken });
    if (!token) {
      return res.json(false);
    }

    let tokenData = jwt.decode(token.refreshToken);
    const user = await UserModel.findById(tokenData.id);
    if (!user) {
      return res.json(false);
    }

    const isValid = jwt.verify(
      token.refreshToken,
      process.env.REFRESH_TOKEN_SECRETSTRING
    );
    if (!isValid) {
      return res.json(false);
    }
    return res.json(true);
  } catch (error) {
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// forgot password
exports.forgotPassword = async function (req, res, next) {
  try {
    const { email } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "A user with this email is not found",
      });
    }

    // generate the otp

    const otp = Math.floor(1000 + Math.random() * 9000);

    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const response = await emailSender.sendingEmail(
      email,
      "Email to reset your password",
      `Your OTP to reset your password is : ${otp}`
    );

    return res.json({ message: response.message });
  } catch (error) {
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
