const mediaHelper = require("../../heplers/filehelper");
const util = require("util");
const CategoryModel = require("../../models/category");

exports.addCategory = async function (req, res, next) {
  //upload the image first and save the path

  try {
    const imageUpload = util.promisify(
      mediaHelper.fileUpload.fields([{ name: "image", maxCount: 1 }])
    );
    try {
      await imageUpload(req, res);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        type: error.code,
        message: `${error.message}{${error.field}}`,
        storageErrors: error.storageErrors,
      });
    }
    const image = req.files["image"][0];
    if (!image) {
      return res.status(404).json({
        message: "Image not found in the request",
      });
    }

    req.body["image"] = `${req.protocol}://${req.get("host")}/${image.path}`;

    CategoryModel.create(req.body)
      .then((category) => {
        return res.status(201).json({
          message: "Category created successfully",
          category: category,
        });
      })
      .catch((error) => {
        return res.status(500).json({
          type: error.name,
          message: error.message,
        });
      });
  } catch (error) {
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

exports.deleteCategory = async function (req, res, next) {
  try {
    // find the id of the category to delete

    const categoryId = req.params.id;
    const category = await CategoryModel.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ message: `Couldn't find the category to be deleted` });
    }
    category.markForDeletion = true;
    await category.save();
  } catch (error) {
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
// edit category

exports.editCategory = async function (req, res, next) {
  try {
    const { icon, name, color } = req.body;
    const categoryId = req.params.id;

    const category = await CategoryModel.findByIdAndUpdate(
      req.params.id,
      {
        icon,
        color,
        name,
      },
      {
        new: true,
      }
    );

    if (!category) {
      return res.status.json(500)({ message: "could not update hte category" });
    }
    return res.json(category);
  } catch (error) {
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
