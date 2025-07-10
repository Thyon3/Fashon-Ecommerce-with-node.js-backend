const mongoose = require("mongoose");

const categorySchema = mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, default: "#000000" },
  image: { type: String, required: true },
  markedForDeleteion: { type: Boolean, default: false },
});

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
