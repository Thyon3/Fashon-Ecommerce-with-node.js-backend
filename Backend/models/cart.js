const mongoose = require("mongoose");

const CartSchema = mongoose.Schema({
  product: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "Product",
  },
  productName: { type: String, required: true },
  productImage: { type: String, required: true },
  productPrice: { type: String, required: true },
  selectedSize: String,
  selectedColor: String,
  quantity: { type: Number, default: 1 },
  reservationExpiry: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 60 * 1000),
  },
  isResesrved: { type: Boolean, default: false },
});

const CartItem = mongoose.model("CartItem", CartSchema);

module.exports = CartItem;
