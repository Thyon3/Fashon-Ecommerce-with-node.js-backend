const mongoose = require("mongoose");

const OrderSchema = mongoose.Schema({
  orderItem: [
    { type: mongoose.Types.ObjectId, required: true, ref: "OrderItem" },
  ],
  shippingAddress: { type: String, required: true },
  country: { type: String, required: true },
  city: String,
  postalCode: String,
  phone: { type: String, required: true },
  paymentID: String,
  status: {
    type: String,
    default: "pending",
    enum: [
      "pending",
      "on-hold",
      "delivered",
      "cancelled",
      "expired",
      "shipped",
      "processed",
      "out-of-delivery",
    ],
  },
  statusHistory: {
    type: [String],
    enum: [
      "pending",
      "on-hold",
      "delivered",
      "cancelled",
      "expired",
      "shipped",
      "processed",
      "out-of-delivery",
    ],
  },

  user: { type: mongoose.Types.ObjectId, ref: "User", required: true },
  dateOrdered: { type: Date, default: Date.now() },
  totalPrice: Number,
});

const Order = mongoose.model("Order", OrderSchema);

module.exports = Order;
