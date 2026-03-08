const mongoose = require("mongoose");

const OrderSchema = mongoose.Schema({
  orderItem: [
    { type: mongoose.Types.ObjectId, required: true, ref: "OrderItem" },
  ],
  shippingAddress: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },
  city: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  phone: { type: String, required: true, trim: true },
  paymentID: { type: String, trim: true },
  paymentMethod: {
    type: String,
    enum: ["credit_card", "debit_card", "paypal", "cash_on_delivery"],
    default: "cash_on_delivery"
  },
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
  statusHistory: [{
    status: {
      type: String,
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
    timestamp: { type: Date, default: Date.now },
    note: { type: String, trim: true }
  }],
  trackingNumber: { type: String, trim: true },
  user: { type: mongoose.Types.ObjectId, ref: "User", required: true },
  dateOrdered: { type: Date, default: Date.now },
  totalPrice: { type: Number, required: true, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  shippingCost: { type: Number, default: 0, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  notes: { type: String, trim: true, maxlength: 500 },
});

const Order = mongoose.model("Order", OrderSchema);

module.exports = Order;
