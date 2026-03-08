const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const checkoutController = require("../controllers/checkout");

// Validation middleware
const validateCheckout = [
  body("shippingAddress")
    .notEmpty()
    .withMessage("Shipping address is required")
    .isLength({ max: 500 })
    .withMessage("Shipping address must not exceed 500 characters"),
  body("paymentMethod")
    .optional()
    .isIn(["credit_card", "debit_card", "paypal", "cash_on_delivery"])
    .withMessage("Invalid payment method"),
  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Notes must not exceed 500 characters"),
];

// Get checkout details for a user
router.get("/:id", checkoutController.getCheckoutDetails);

// Create checkout (place order)
router.post(
  "/",
  validateCheckout,
  checkoutController.createCheckout
);

module.exports = router;
