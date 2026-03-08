const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const orderController = require("../controllers/order");

// Validation middleware
const validateStatusUpdate = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn([
      "pending", "on-hold", "delivered", "cancelled", 
      "expired", "shipped", "processed", "out-of-delivery"
    ])
    .withMessage("Invalid status"),
  body("note")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Note must not exceed 200 characters"),
];

// Get all orders for a user
router.get("/user/:id", orderController.getOrders);

// Get order statistics for a user
router.get("/stats/:id", orderController.getOrderStats);

// Get specific order by ID
router.get("/user/:userId/order/:orderId", orderController.getOrderById);

// Update order status (for admin use)
router.put(
  "/:orderId/status",
  validateStatusUpdate,
  orderController.updateOrderStatus
);

// Cancel an order
router.delete("/user/:userId/order/:orderId", orderController.cancelOrder);

module.exports = router;
