// create a user schema and a collection for the user

const mongoose = require("mongoose");
const CartItem = require("./cart_item");

const userSchema = mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 6
  },
  street: { type: String, default: "", trim: true },
  apartment: { type: String, default: "", trim: true },
  postalCode: { type: String, default: "", trim: true },
  country: { type: String, default: "", trim: true },
  cart: [{ type: mongoose.Types.ObjectId, ref: "CartItem" }],
  phone: {
    type: String,
    required: true,
    trim: true,
    match: [/^[\d\s\-\+\(\)]+$/, 'Please fill a valid phone number']
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  resetPasswordOtp: Number,
  resetPasswordOtpExpires: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },

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
