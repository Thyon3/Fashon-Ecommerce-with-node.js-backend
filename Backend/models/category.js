const mongoose = require("mongoose");

const categorySchema = mongoose.Schema({
  icon: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 50 },
  color: { type: String, default: "#000000", match: [/^#[0-9A-F]{6}$/i, 'Please provide a valid hex color'] },
  image: { type: String, required: true, trim: true },
  markForDeletion: { type: Boolean, default: false },
  description: { type: String, trim: true, maxlength: 200 },
  parentCategory: { type: mongoose.Types.ObjectId, ref: "Category" },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

categorySchema.index({ name: 1 }, { unique: true });

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
