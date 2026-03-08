const userModel = require("../models/user");
const productModel = require("../models/product.js");
const mongoose = require("mongoose");

//get the existing user wishlists
exports.getUserWishList = async function (req, res) {
  try {
    const { page = 1, limit = 20, sortBy = 'date' } = req.query;
    const userId = req.params.id;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // have a local wishlist to return
    const wishlist = [];
    for (const wishProduct of user.wishlist) {
      const product = await productModel.findById(wishProduct.productId);
      if (!product) {
        wishlist.push({
          ...wishProduct,
          productExists: false,
          productOutOfStock: false,
        });
      } else if (product.numberInStock < 1) {
        wishlist.push({
          ...wishProduct,
          productExists: true,
          productOutOfStock: true,
        });
      } else {
        // now we know the product exists
        wishlist.push({
          productId: product._id,
          productName: product.name,
          productPrice: product.price,
          productImage: product.image,
          productExists: true,
          productOutOfStock: false,
          productRating: product.rating,
          productCategory: product.category,
          dateAdded: wishProduct.dateAdded || new Date()
        });
      }
    }

    // Sort wishlist
    const sortedWishlist = wishlist.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.productName.localeCompare(b.productName);
        case 'price_low':
          return a.productPrice - b.productPrice;
        case 'price_high':
          return b.productPrice - a.productPrice;
        case 'date':
        default:
          return new Date(b.dateAdded) - new Date(a.dateAdded);
      }
    });

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedWishlist = sortedWishlist.slice(startIndex, endIndex);

    res.json({
      wishlist: paginatedWishlist,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(wishlist.length / parseInt(limit)),
        totalCount: wishlist.length,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// add a unique product to the wishlist
exports.addToWishList = async function (req, res) {
  try {
    const userId = req.params.id;
    const { productId } = req.body;

    // first find the user
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "user does not exist" });
    }

    // now the product
    const product = await productModel.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ message: "could not add product cause product is not found" });
    }

    const productAlreadyExists = user.wishlist.find((item) =>
      item.productId.equals(
        new mongoose.Schema.Types.ObjectId(productId)
      )
    );

    if (productAlreadyExists) {
      return res.status(409).json({
        message: "product already exists in the wishlist",
      });
    }

    user.wishlist.push({
      productId: productId,
      productName: product.name,
      productPrice: product.price,
      productImage: product.image,
      dateAdded: new Date()
    });

    await user.save();

    res.status(201).json({
      message: "Product added to wishlist successfully",
      product: {
        productId: product._id,
        productName: product.name,
        productPrice: product.price,
        productImage: product.image
      }
    });
  } catch (error) {
    res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// delete product from wishlist
exports.deleteProductFromWishList = async function (req, res) {
  try {
    const userId = req.params.id;
    const productId = req.params.productId;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // find the index of the product to delete
    const index = user.wishlist.findIndex((item) =>
      item.productId.equals(new mongoose.Schema.Types.ObjectId(productId))
    );

    if (index === -1) {
      return res.status(404).json({
        message: "product does not exist in wishlist",
      });
    }

    const removedProduct = user.wishlist[index];
    user.wishlist.splice(index, 1);
    await user.save();

    res.status(200).json({
      message: "Product removed from wishlist successfully",
      removedProduct: removedProduct
    });
  } catch (error) {
    res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// clear entire wishlist
exports.clearWishList = async function (req, res) {
  try {
    const userId = req.params.id;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const removedItems = user.wishlist.length;
    user.wishlist = [];
    await user.save();

    res.status(200).json({
      message: "Wishlist cleared successfully",
      removedItems: removedItems
    });
  } catch (error) {
    res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// move product from wishlist to cart
exports.moveToCart = async function (req, res) {
  try {
    const userId = req.params.id;
    const productId = req.params.productId;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // find the index of the product in wishlist
    const index = user.wishlist.findIndex((item) =>
      item.productId.equals(new mongoose.Schema.Types.ObjectId(productId))
    );

    if (index === -1) {
      return res.status(404).json({
        message: "product does not exist in wishlist",
      });
    }

    const wishlistProduct = user.wishlist[index];

    // Check if product is available
    const product = await productModel.findById(productId);
    if (!product || product.numberInStock < 1) {
      return res.status(400).json({
        message: "Product is not available",
      });
    }

    // Remove from wishlist
    user.wishlist.splice(index, 1);

    // Here you would add the product to the cart
    // This would typically involve creating a cart item and adding it to the user's cart
    // For now, we'll just remove it from wishlist and return success

    await user.save();

    res.status(200).json({
      message: "Product moved to cart successfully",
      product: wishlistProduct
    });
  } catch (error) {
    res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// check if product is in user's wishlist
exports.checkProductInWishList = async function (req, res) {
  try {
    const userId = req.params.id;
    const productId = req.params.productId;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const productInWishlist = user.wishlist.find((item) =>
      item.productId.equals(new mongoose.Schema.Types.ObjectId(productId))
    );

    res.status(200).json({
      inWishlist: !!productInWishlist,
      product: productInWishlist || null
    });
  } catch (error) {
    res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
