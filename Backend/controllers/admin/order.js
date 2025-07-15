const { json } = require("body-parser");
const Orders = require("../../models/order");
const OrderItem = require("../../models/order_item");
const product = require("../../models/product");

exports.getOrders = async function (_, res) {
  try {
    const order = await Orders.find()
      .select("-statusHistory")
      .sort({ dateOrdered: -1 })
      .populate("user", "name email phone postalCode")
      .populate({
        path: "orderItem",
        populate: {
          path: "product",
          select: "name price", // include any fields you want from Product
        },
      });
    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }
    return res.json(order);
  } catch (error) {
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
exports.countOrder = async function (req, res, next) {
  try {
    const count = await Orders.countDocuments();
    if (!count) {
      return res.status(404).json({ message: "could not count the orders" });
    }
    return res.json(count);
  } catch (error) {
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

exports.deleteOrders = async function (req, res, next) {
  // find the id of the order from teh request
  try {
    const { id } = req.body;
    const orderToDelete = await Orders.findByIdAndDelete(id);
    if (!orderToDelete) {
      return res.status(404).json({
        message: "could not delete the order",
      });
    }
    // delete all the order items which are realted to teh delted order
    for (const orderitem of Orders.OrderItem) {
      await OrderItem.findByIdAndDelete(orderitem);
    }
    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({ type: error.name, message: error.message });
  }
};
exports.changeOrderStatus = async function (req, res, next) {};
