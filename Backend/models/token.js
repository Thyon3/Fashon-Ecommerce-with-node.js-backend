const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
  },
  accessToken: String,
  refreshToken: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 86400,
  },
});

const token = mongoose.model("Token", tokenSchema);
module.exports = token;
