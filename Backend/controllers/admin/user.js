// users

const UserModel = require("../../models/user");
const Orders = require("../../models/order");
const OrderItem = require("../../models/order_item");
const Order = require("../../models/order");
const CartItems = require("../../models/cart");
const Token = require("../../models/token");

exports.countUsers = async function (_, res) {
  try {
    const count = await UserModel.countDocument();
    if (!count) {
      return res.status(401).json({
        message: "could not count users",
      });
    }
    return res.json(count);
  } catch (error) {
    return res.stauts(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
exports.deleteUser = async function (req, res, next) {
  try {
    const id = req.params.id;
    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const orders = await Order.find({ user: id });
    const orderItemIds = orders.flatMap((order) => order.orderItem);

    await Order.deleteMany({ user: id });
    await OrderItem.deleteMany({ _id: { $in: orderItemIds } });

    await CartItems.deleteMany({ _id: { $in: user.cart } });
    await UserModel.findByIdAndUpdate(id, { $unset: { cart: 1 } });

    await Token.deleteOne({ userId: id });
    await UserModel.deleteOne({ _id: id });

    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({ type: error.name, message: error.message });
  }
};

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
