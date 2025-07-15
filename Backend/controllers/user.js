const UserModel = require("../models/user");
exports.getAllUsers = async function (_, res, next) {
  try {
    const user = await UserModel.find().select("name email isAdmin phone");
    if (!user) {
      return res.status(404).json("You don not have a user");
    }
    return res.json(user);
  } catch (error) {
    res.send(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

exports.getUsersByID = async function (req, res, next) {
  try {
    const id = req.params.id;
    const user = UserModel.getUsersByID(id).select(
      "-passwordHash -resetPasswordOtpExpires -resetPasswordOtp"
    );
    if (!user) {
      return res.status(404).json({ message: "A user is Not found" });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
exports.updateUsersById = async function (req, res, next) {
  try {
    // we can update the name, email or phone of the user
    const { name, email, phone } = req.body;
    const id = req.params.id;

    // update the users' variables now
    const user = await UserModel.FindByIdAndUpdate(
      id,
      { name: name, email: email, phone: phone },
      { new: true }
    );
    // make the passwod undefined before sending hte data to the user
    user.passwordHash = undefined;
    if (!user) {
      return res.status(404).json({ message: "A user is not foudn " });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
