const express = require("express");
const router = express.Router();

const UserController = require("../controllers/admin/user");
const CategoryController = require("../controllers/admin/category");
const OrderController = require("../controllers/admin/order");
const ProductController = require("../controllers/admin/product");

//User
router.get("/user/count", UserController.countUsers);
router.delete("/user/:id", UserController.deleteUser);
router.get("/user", UserController.getAllUsers);
router.get("/user/:id", UserController.getUsersByID);
router.put("/user/:id", UserController.updateUsersById);

//categories
router.post("/category", CategoryController.addCategory);
router.put("/category/:id", CategoryController.editCategory);
router.delete("/category/:id", CategoryController.deleteCategory);

//Products
router.get("/products", ProductController.getProducts);
router.post("/products", ProductController.addProduct);
router.put("products/:id", ProductController.editProduct);
router.delete("products/:id/image", ProductController.deleteProductImage);
router.delete("produts/:id", ProductController.deleteProduct);

//Orders
router.get("/order", OrderController.getOrders);
router.put("/order/", OrderController.countOrder);
router.delete("/order/:id", OrderController.changeOrderStatus);

module.exports = router;
