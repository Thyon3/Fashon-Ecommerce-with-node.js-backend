const express = require("express");
const router = express.Router();

const UserControlller = require("../controllers/user");
const wishListController = require("../controllers/wishlist");
const cartController = require("../controllers/cart");

// get and update profile
router.get("/", UserControlller.getUsers);
router.get("/:id", UserController.getUserById);
router.put("/:id", UserController.updateUserById);

// wishlist
router.get("/:id/wishlist", wishListController.getUserWishList);
router.post("/:id/wishlist", wishListController.addToWishList);
router.delete(
  "/:id/wishlist/:productId",
  wishListController.deleteProductFromWishList
);

// cart
router.get("/:id/cart", cartController.getUserCart);
router.get("/:id/cart/count", cartController.getUserCartCount);
router.get("/:id/cart/:productId", cartController.getProductById);
router.post("/:id/cart", cartController.addToCart);
router.put("/:id/cart/:productId", cartController.modifyQuantity);
router.delete("/:id/cart/:productId", cartController.removeFromCart);
module.exports = router;
