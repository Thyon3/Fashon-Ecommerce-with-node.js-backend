// users

const UserModel = require("../models/user");
const Orders = require("../models/order");
const OrderItem = require("../models/order_item");
const Order = require("../models/order");
const CartItems = require("../models/cart");
const Token = require("../models/token");

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

// Categories
exports.addCategory = async function (req, res, next) {};
exports.editCategory = async function (req, res, next) {};
exports.deleteCategory = async function (req, res, next) {};

// Product
exports.addProduct = async function (req, res, next) {};
exports.editProduct = async function (req, res, next) {};
exports.deleteProduct = async function (req, res, next) {};
exports.deleteProductImage = async function (req, res, next) {};
exports.getProducts = async function (req, res, next) {};

// Order
exports.countOrder = async function (req, res, next) {};
exports.changeOrderStatus = async function (req, res, next) {};
exports.getOrders = async function (req, res, next) {};
