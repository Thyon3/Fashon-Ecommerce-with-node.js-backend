const express = require("express");
const router = express.Router();
const controller = require("../controllers/category");
// catergories routers

router.get("/", controller.getAllCategories);
router.get("/:id", controller.getCategoriesById);

module.exports = router;
