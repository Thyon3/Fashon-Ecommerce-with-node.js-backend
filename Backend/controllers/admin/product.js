const multer = require("multer");
const mongoose = require("mongoose");
const mediaHelper = require("../../heplers/filehelper");

const Category = require("../../models/category");
const product = require("../../models/product");
const Review = require("../../models/review");

// count the number of products
exports.getProductCount = async function (_, res) {
  try {
    const count = await product.countDocuments();
    if (!count) {
      return res.status(404).json({
        message: "could not count products",
      });
    }
    return res.json(count);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// adding products
exports.addProduct = async function (req, res) {
  try {
    const imageUpload = util.promisify(
      mediaHelper.fileUpload.fields([
        { name: "image", maxCount: 1 },
        { name: "images", maxCount: 10 },
      ])
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

    // before adding the product first check if the category either exists or is marked for deletion

    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(404).json({
        message: "Invalid category",
      });
    }
    if (category.markForDeletion) {
      return res.status(500).json({
        message: "You can not add to this category",
      });
    }
    // add the image for the product
    const image = req.files["image"][0];
    if (!image) {
      return res.status(404).json({
        message: "Image not found in the request",
      });
    }
    req.body["image"] = `${req.protocol}://${req.get("host")}/${image.path}`;

    // add the images for the product
    const images = req.files["images"];
    const imagesPath = [];

    if (images) {
      for (image of images) {
        const imagePath = `${req.protocol}://${req.get("host")}/${image.path}`;
        imagesPath.push(imagePath);
      }
      if (imagesPath.length > 0) {
        req.body["images"] = imagesPath;
      }
    }

    const newProduct = await new product(req.body);
    await newProduct.save();

    if (!newProduct) {
      return res.status(500).json({
        message: "could not create product try again later",
      });
    }
    return res.status(200).json(newProduct);
  } catch (error) {
    console.error(error);
    if (error instanceof multer.MulterError) {
      return res.status(error.code).json({
        message: error.message,
      });
    }
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// Editing the products
exports.editProduct = async function (req, res) {
  try {
    // a quick check if the ids passed by the user are valid
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !(await product.findById(req.params.id))
    ) {
      return res.status(404).json({
        message: "could not find the product",
      });
    }

    // check if we hav a valid category
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        return res.status(404).json({
          message: "Invalid category",
        });
      }
      if (category.markForDeletion) {
        return res.status(404).json({
          message: "This category is marked for deletion so you can edit it ",
        });
      }
    }

    //editing the images fo the product
    const productTobeEdited = await product.findById(req.params.id);
    if (productTobeEdited.images) {
      // first upload the requested images
      const limit = 10 - productTobeEdited.images.length;
      const imageUpload = util.promisify(
        mediaHelper.fileUpload.fields([{ name: "images", maxCount: limit }])
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

      //
      const imageFiles = req.files["images"];
      if (imageFiles && imageFiles.length > 0) {
        const imagesPath = [];
        for (image of imageFiles) {
          const imagePath = `${req.protocol}://${req.get("host")}/${
            image.path
          }`;
          imagesPath.push(imagePath);
        }
        req.body["images"] = [...productTobeEdited.images, ...imagesPath];
      }
    }
    //editing the main image
    if (productTobeEdited.image) {
      // first upload the new image
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
      // uploading the image
      const image = req.files["image"][0];
      if (!image) {
        return res.status(404).json({
          message: "Image not found in the request",
        });
      }
      req.body["image"] = `${req.protocol}://${req.get("host")}/${image.path}`;
    }
    // finally edit the product

    const updatedProduct = await product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      }
    );
    if (!updatedProduct) {
      return res.status(500).json({
        message: "failed to edit the product ",
      });
    }
    return res.status(201).json(updatedProduct);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

// deleting the product images

exports.deleteProductImage = async function (req, res) {
  // first check if the id is valid
  try {
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !product.findById(req.params.id)
    ) {
      return res.status(404).json({
        message: "Invalid Id",
      });
    }
    const { deletedImageUrls } = req.body;

    // call the medial helper for deleteing the images

    await mediaHelper.deleteImages(deletedImageUrls);
    const temProduct = await product.findById(req.params.id);
    if (!temProduct) {
      return res.status(404).json({
        message: "could not find product",
      });
    }
    // now filter the deleted image paths from req.body.images
    temProduct.images = temProduct.images.filter(
      (image) => !deletedImageUrls.includes(image)
    );

    await product.save();
  } catch (error) {
    console.error(error);
    if ((error.code = "ENOET")) {
      return res.status(404).json({
        message: "image not found",
      });
    }
    return res.status(500).json({
      message: "image not found",
    });
  }
};
exports.deleteProduct = async function (req, res) {
  try {
    const productId = req.params.id;
    const productTo = await product.findById(productId);
    if (!productTo) {
      return res.status(404).json({
        message: "product not found ",
      });
    }
    // first delete the images and the previews of the product
    await mediaHelper.deleteImafges(
      [...productTo.images, productTo.image],
      "ENOET"
    );
    // delete the reviews
    await Review.deleteMany({ _id: { $in: productTo.reviews } });

    // delete th eproduct finally
    await product.findByIdAndDelete(productId);
    return res.status(204).end();
  } catch (error) {
    console.error(error);
    if ((error.code = "ENOET")) {
      return res.status(404).json({
        message: "image not found",
      });
    }
    return res.status(500).json({
      message: "image not found",
    });
  }
};

// get products
exports.getProducts = async function (_, res) {
  try {
    // we use pagination with a starting page and limit of pages
    const page = req.query.page; // when Page = 1, starting from the very first document
    // when page = 2, starting from the 11th document cause our page size is 10 per page
    const pageSize = 10;

    //
    const availProduct = await product
      .find()
      .select("-rating -reviews")
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    if (!availProduct) {
      return res.status(404).json({
        message: "Prodcut Not found",
      });
    }
    return res.json(availProduct);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
