// create a user schema and a collection for the user

const mongoose = require("mongoose");
const CartItem = require("./cart_item");

const userSchema = mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  street: { type: String, default: "" },
  apartment: { type: String, default: "" },
  postalCode: { type: String, default: "" },
  country: { type: String, default: "" },
  cart: [{ type: mongoose.Types.ObjectId, ref: "CartItem" }],
  phone: {
    type: String,
    required: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  resetPasswordOtp: Number,
  resetPasswordOtpExpires: Date,

  wishlist: [
    {
      productId: {
        type: mongoose.Schema.ObjectId,
        ref: "Product",
        required: true,
      },
      ProductImage: { type: String, required: true },
      ProductName: { type: String, required: true },
      ProductPrice: { type: String, required: true },
    },
  ],
});
userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);
module.exports = User;
