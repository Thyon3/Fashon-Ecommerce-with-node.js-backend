const express = require("express");
const router = express.Router();

const AdminController = require("../controllers/admin");

//User
router.get("/user", AdminController.countUsers);
router.delete("/user:id", AdminController.deleteUser);

//categories
router.post("/category", AdminController.addCategory);
router.put("/category/:id", AdminController.editCategory);
router.delete("/category/:id", AdminController.deleteCategory);

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
