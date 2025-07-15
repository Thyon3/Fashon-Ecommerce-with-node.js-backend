const mongoose = require("mongoose");

const mongooseSchema = mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  images: [{ type: String }],
  price: { type: Number, required: true },
  rating: { type: Number, default: 0.0 },
  Colors: [{ type: String }],
  sizes: [{ type: String }],
  category: { type: mongoose.Types.ObjectId, ref: "Category" },
  reviews: [{ type: mongoose.Types.ObjectId, ref: "Review" }],
  numberOfReviews: { type: Number, defalut: 0.0 },
  genderAgeCategory: {
    type: String,
    enum: ["men", "women", "kids", "unisex"],
  },
  numberInStock: { type: Number, required: true, min: 0, max: 255 },
  createdDate: { type: Date, default: Date.now() },
});

// presave hooks
mongooseSchema.pre("save", async function (next) {
  try {
    if (this.reviews && this.reviews.length > 0) {
      await this.populate("reviews");

      const totalReview = this.reviews.reduce(
        (acc, review) => acc + review.rating,
        0
      );
      const reviewCount = this.reviews.length;

      this.rating = parseFloat((totalReview / reviewCount).toFixed(1));
      this.numberOfReviews = reviewCount;
    }
    next();
  } catch (error) {
    next(error); // forward error to Mongoose
  }
});

mongooseSchema.index({ name: "text", description: "text" });

const Product = mongoose.model("Product", mongooseSchema);
module.exports = Product;
