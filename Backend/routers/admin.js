const express = require("express");
const router = express.Router();

const UserController = require("../controllers/admin/user");
const CategoryController = require("../controllers/admin/category");

//User
router.get("/user", UserControllerController.countUsers);
router.delete("/user:id", UserController.deleteUser);

//categories
router.post("/category", CategoryController.addCategory);
router.put("/category/:id", CategoryController.editCategory);
router.delete("/category/:id", CategoryController.deleteCategory);

//Products
// get put delete add

router.get("/products", AdminController.getProducts);
router.post("/products", AdminController.addProduct);
router.put("products/:id", AdminController.editProduct);
router.delete("products/:id/image", AdminController.deleteProductImage);
router.delete("produts/:id", AdminController.deleteProduct);
//Orders
router.get("/order", AdminController.getOrders);
router.put("/order/", AdminController.countOrder);
router.delete("/order/:id", AdminController.changeOrderStatus);
