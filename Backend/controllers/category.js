const CategoryModel = require("../models/category");

exports.getAllCategories = async function (req, res) {
  try {
    const categories = await CategoryModel.find().select("-markForDeletion");
    if (!categories) {
      return res.status(404).json({
        message: "category not found",
      });
    }
    return res.json(categories);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
exports.getCategoriesById = async function (req, res) {
  try {
    //
    const id = req.params.id;
    const category = await CategoryModel.findById(id).select(
      "-markForDeletion"
    );
    if (!category) {
      return res.status(404).json({
        message: "category not found",
      });
    }
    return res.json(category);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
