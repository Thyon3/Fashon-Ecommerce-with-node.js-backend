const ReviewModel = require("../models/review");
const ProductModel = require("../models/product");
const UserModel = require("../models/user");

// Create a product review
exports.createReview = async function (req, res) {
  try {
    const { productId, rating, title, comment } = req.body;
    const userId = req.user.id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating must be between 1 and 5"
      });
    }

    // Check if product exists
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    // Check if user has already reviewed this product
    const existingReview = await ReviewModel.findOne({
      user: userId,
      product: productId
    });

    if (existingReview) {
      return res.status(400).json({
        message: "You have already reviewed this product"
      });
    }

    // Create new review
    const review = new ReviewModel({
      user: userId,
      product: productId,
      rating: parseInt(rating),
      title: title || '',
      comment: comment || ''
    });

    const savedReview = await review.save();

    // Populate review with user and product info
    const populatedReview = await ReviewModel.findById(savedReview._id)
      .populate('user', 'name email')
      .populate('product', 'name');

    res.status(201).json({
      message: "Review created successfully",
      review: populatedReview
    });

  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Update a review
exports.updateReview = async function (req, res) {
  try {
    const { reviewId } = req.params;
    const { rating, title, comment } = req.body;
    const userId = req.user.id;

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        message: "Rating must be between 1 and 5"
      });
    }

    // Find review
    const review = await ReviewModel.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        message: "Review not found"
      });
    }

    // Check if user owns this review
    if (review.user.toString() !== userId) {
      return res.status(403).json({
        message: "You can only update your own reviews"
      });
    }

    // Update review
    if (rating) review.rating = parseInt(rating);
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;

    await review.save();

    // Populate review with user and product info
    const populatedReview = await ReviewModel.findById(review._id)
      .populate('user', 'name email')
      .populate('product', 'name');

    res.status(200).json({
      message: "Review updated successfully",
      review: populatedReview
    });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Delete a review
exports.deleteReview = async function (req, res) {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    // Find review
    const review = await ReviewModel.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        message: "Review not found"
      });
    }

    // Check if user owns this review or is admin
    const user = await UserModel.findById(userId);
    if (review.user.toString() !== userId && !user.isAdmin) {
      return res.status(403).json({
        message: "You can only delete your own reviews"
      });
    }

    await ReviewModel.findByIdAndDelete(reviewId);

    res.status(200).json({
      message: "Review deleted successfully"
    });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get reviews for a product
exports.getProductReviews = async function (req, res) {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sortBy = 'newest' } = req.query;

    // Check if product exists
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    // Build sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'oldest':
        sortOptions.createdAt = 1;
        break;
      case 'rating_high':
        sortOptions.rating = -1;
        break;
      case 'rating_low':
        sortOptions.rating = 1;
        break;
      default: // newest
        sortOptions.createdAt = -1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get reviews
    const reviews = await ReviewModel.find({ product: productId })
      .populate('user', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalCount = await ReviewModel.countDocuments({ product: productId });

    // Calculate rating distribution
    const ratingDistribution = await ReviewModel.aggregate([
      { $match: { product: productId } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    // Format rating distribution
    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0
    };

    ratingDistribution.forEach(item => {
      distribution[item._id] = item.count;
    });

    res.status(200).json({
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit)
      },
      ratingDistribution: distribution,
      averageRating: product.rating,
      totalReviews: product.numberOfReviews
    });

  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get user's reviews
exports.getUserReviews = async function (req, res) {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await ReviewModel.find({ user: userId })
      .populate('product', 'name image price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await ReviewModel.countDocuments({ user: userId });

    res.status(200).json({
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};
