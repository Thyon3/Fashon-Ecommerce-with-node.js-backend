//import validation result from express validator
const bcrypt = require("bcrypt");
const UserModel = require("../models/user");
const { validationResult } = require("express-validator");

exports.register = async function (req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty) {
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

exports.login = async function (req, res, next) {};
