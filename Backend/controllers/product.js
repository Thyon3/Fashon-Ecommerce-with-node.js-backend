const productModel = require("../models/product");
const Review = require("../models/review");
const User = require("../models/user");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

exports.getAllPrducts = async function () {
  try {
    //
    const page = req.query.page || 1;
    const pageSize = 10;
    let products;
    // check if the user is fetching the products based on some criteria
    if (req.query.criteria) {
      let query = {};
      if (req.query.category) {
        query["category"] = req.query.category;
      }
      switch (req.query.criteria) {
        case "newArrivals":
          let twoWeeksAgo = new Date();
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
          query["dateAdded"] = { $gte: twoWeeksAgo };
          break;
        case "popular":
          query["rating"] = { $gte: 4.5 };
          break;
        default:
          break;
      }
      products = await productModel
        .find(query)
        .select("-images -reviews -sizes ")
        .skip((page - 1) * pageSize)
        .limit(pageSize);
    } else if (req.query.category) {
      products = await productModel
        .find({ category: req.query.category })
        .select("-images -reviews -sizes")
        .skip((page - 1) * pageSize)
        .limit(pageSize);
    } else {
      products = await productModel
        .find()
        .select("-images -reviews -sizes")
        .skip((page - 1) * pageSize)
        .limit(pageSize);
    }

    //
    if (!products) {
      return res.status(404).json({
        message: "product does not found",
      });
    }
    return res.json(products);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
exports.searchProduct = async function () {
  try {
    const page = req.query.page || 1;
    const pageSize = 10;

    const searchTerm = req.query.q;
    let query = {};
    // if the user passes the category?
    if (req.query.category) {
      query = {
        category: req.query.category,
      };
      if (req.query.genderAgeCategory) {
        query["genderAgeCategory"] = req.query.genderAgeCategory;
      }
    } else if (req.query.genderAgeCategory) {
      query = { genderAgeCategory: req.query.genderAgeCategory };
    }
    if (searchTerm) {
      query = {
        ...query,
        $text: {
          $search: searchTerm,
          $language: "english",
          $caseSensetive: false,
        },
      };
    }

    // now we have a completed full query
    const searchResult = await productModel
      .find(query)
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    if (!searchResult) {
      return res.status(404).json({
        message: "product not found",
      });
    }
    return res.json(searchResult);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
exports.getPrductsById = async function () {
  try {
    const id = req.params.id;
    const products = await productModel.findById(id).select("-reviews");
    if (!products) {
      return res.status(404).json({
        message: "product not found",
      });
    }
    return res.json(products);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
exports.leaveReview = async function () {
  try {
    // check if the user giving the review is valid
    const user = await User.find(req.body.user);
    if (!user) {
      return res.status(404).json({
        message: "Invalid User",
      });
    }
    //
    const review = new Review({
      ...req.body,
      userName: user.name,
    }).save();
    if (!review) {
      return res.status(400).json({
        message: "could not save the review",
      });
    }

    // now giving the review to the specific product
    const product = await productModel.findById(req.params.id);
    if (!product) {
      return res.status(400).json({
        message: "could not find the prodcut to give the review ",
      });
    }
    // now add the review to the product
    product.reviews.push(review);

    product = await product.save();
    if (!product) {
      return res.status(400).json({
        message: "could not save the product",
      });
    }
    res.status(201).json({ product, review });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
exports.getProductReviews = async function () {
  // start transaction
  const session = await mongoose.startSession;
  await session.startTransaction();
  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "product not found",
      });
    }

    const page = req.query.page;
    const pageSize = 10;

    // find the reviews of the specific product
    const reviews = await Review.find({
      _id: { $in: product.reviews },
    })
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    //
    const processedReviews = [];
    for (const review of reviews) {
      const user = await User.findById(review.user);
      if (!user) {
        processedReviews.push(review);
        continue;
      }
      let newReview;
      if (review.userName !== user.name) {
        review.userName = user.name;
        newReview = await review.save({ session });
      }
      processedReviews.push(newReview ?? review);
    }
    await session.commitTransaction();
    return res.json(processedReviews);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};
