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
router.post("/:id/cart", cartController.addToCart);
router.put("/:id/cart/:cartItemId", cartController.modifyQuantity);
router.delete("/:id/cart/:cartItemId", cartController.removeFromCart);
router.get("/:id/cart/count", cartController.getUserCartCount);
module.exports = router;
