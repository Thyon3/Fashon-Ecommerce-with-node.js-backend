const express = require("express");
const router = express.Router();
const controller = require("../controllers/product");

// get all prodcuts get products by ID  search  leave a review for a certain product  get the review of  a  product

router.get("/", controller.getAllPrducts);
router.get("/search/", controller.searchProduct);
router.get("/:id", controller.getPrductsById);
router.post("/:id/reviews", controller.leaveReview);
router.get("/id:reviews", controller.getProductReviews);
