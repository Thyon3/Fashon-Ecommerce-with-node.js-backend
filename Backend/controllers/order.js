const OrderModel = require("../models/order");
const OrderItemModel = require("../models/order_item");
const ProductModel = require("../models/product");
const UserModel = require("../models/user");

exports.getOrders = async function (req, res) {
  try {
    const userId = req.params.id;
    
    const orders = await OrderModel.find({ user: userId })
      .populate({
        path: 'orderItem',
        populate: {
          path: 'product',
          select: 'name image price'
        }
      })
      .sort({ dateOrdered: -1 });

    return res.status(200).json(orders);
  } catch (error) {
    console.error("Get orders error:", error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

exports.getOrderById = async function (req, res) {
  try {
    const { userId, orderId } = req.params;
    
    const order = await OrderModel.findOne({ 
      _id: orderId, 
      user: userId 
    })
      .populate({
        path: 'orderItem',
        populate: {
          path: 'product',
          select: 'name image price description'
        }
      });

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    return res.status(200).json(order);
  } catch (error) {
    console.error("Get order by ID error:", error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

exports.updateOrderStatus = async function (req, res) {
  try {
    const { orderId } = req.params;
    const { status, note } = req.body;

    const validStatuses = [
      "pending", "on-hold", "delivered", "cancelled", 
      "expired", "shipped", "processed", "out-of-delivery"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Add status to history
    order.statusHistory.push({
      status: status,
      timestamp: new Date(),
      note: note || `Status changed to ${status}`
    });

    order.status = status;
    
    // If order is cancelled, restore stock
    if (status === "cancelled") {
      const orderItems = await OrderItemModel.find({
        _id: { $in: order.orderItem }
      });

      for (const orderItem of orderItems) {
        await ProductModel.findByIdAndUpdate(orderItem.product, {
          $inc: { numberInStock: orderItem.quantity },
        });
      }
    }

    const updatedOrder = await order.save();

    return res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

exports.cancelOrder = async function (req, res) {
  try {
    const { userId, orderId } = req.params;

    const order = await OrderModel.findOne({ 
      _id: orderId, 
      user: userId 
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Only allow cancellation for pending or on-hold orders
    if (!["pending", "on-hold"].includes(order.status)) {
      return res.status(400).json({
        message: "Order cannot be cancelled at this stage",
      });
    }

    // Restore stock
    const orderItems = await OrderItemModel.find({
      _id: { $in: order.orderItem }
    });

    for (const orderItem of orderItems) {
      await ProductModel.findByIdAndUpdate(orderItem.product, {
        $inc: { numberInStock: orderItem.quantity },
      });
    }

    // Update order status
    order.status = "cancelled";
    order.statusHistory.push({
      status: "cancelled",
      timestamp: new Date(),
      note: "Order cancelled by user"
    });

    await order.save();

    return res.status(200).json({
      message: "Order cancelled successfully",
      order: order,
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

exports.getOrderStats = async function (req, res) {
  try {
    const userId = req.params.id;
    
    const orders = await OrderModel.find({ user: userId });
    
    const stats = {
      totalOrders: orders.length,
      pendingOrders: orders.filter(order => order.status === "pending").length,
      deliveredOrders: orders.filter(order => order.status === "delivered").length,
      cancelledOrders: orders.filter(order => order.status === "cancelled").length,
      totalSpent: orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0),
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error("Get order stats error:", error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
