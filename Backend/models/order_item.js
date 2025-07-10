const mongoose = require("mongoose");

const OrderItemSchema = mongoose.Schema({
  product: { type: mongoose.Types.ObjectId, ref: "Product" },
  quantity: { type: Number, default: 1 },
  // if the product is deleted in some case we want to persist some of its properties like...
  productName: { type: String, required: true },
  productImage: { type: String, required: true },
  productPrice: { type: String, required: true },
  selectedColor: String,
  selectedSize: String,
});

const OrderItem = mongoose.model("OrderItem", OrderItemSchema);
module.exports = OrderItem;
