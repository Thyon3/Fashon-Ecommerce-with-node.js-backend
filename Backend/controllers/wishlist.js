const userModel = require("../models/user");
const productModel = require("../models/product.js");
const mongoose = require("mongoose");

//get the existing user wishlists
exports.getUserWishList = async function (req, res) {
  try {
    //
    const user = await userModel.findById(req.params.id);
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
      } else if (numberInStock < 1) {
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
        });
      }
    }
    res.json(wishlist);
  } catch (error) {
    res.send(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// add  a unique product to the wishlist
exports.addToWishList = async function (req, res) {
  // first find the user
  const user = await userModel.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "user does not exist" });
  }
  // now the product
  const product = await productModel.findById(req.body.productId);
  if (!product) {
    return res
      .status(404)
      .json({ message: "could not add product cause product is not found" });
  }
  const productAlreadyExists = user.wishlist.find((item) =>
    item.productId.equals(
      new mongoose.Schema.Types.ObjectId(req.body.productId)
    )
  );
  if (productAlreadyExists) {
    return res.status(409).json({
      message: "product already exists in the wishlist",
    });
  }
  user.wishlist.push({
    productId: req.body.productId,
    productName: product.name,
    productPrice: product.price,
    productImage: product.image,
  });
  await user.save();
  return res.status(200).end();
};
exports.deleteProductFromWishList = async function (req, res) {
  //
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
      message: "product does not exist",
    });
  }
  user.wishlist.splice(index, 1);
  await user.save();
  return res.status(204).end();
};
