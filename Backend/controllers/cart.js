const userModel = require("../models/user");
const cartItem = require("../models/cart_item");
const productModel = require("../models/product");
const mongoose = require("mongoose");
const CartItem = require("../models/cart_item");
exposts.getUserCart = async function (req, res) {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        message: "user don't found",
      });
    }
    // user.cart -- ther is the id of the cart items

    // find the list of the cart items the user has
    const cartItems = await cartItem.find({
      _id: { $in: user.cart },
    });
    if (!cartItems) {
      return res.status(404).json({
        message: "cart not found",
      });
    }
    let cart = [];
    // loop through each cart item and find the product
    for (cartItem of cartItems) {
      const product = await productModel.findById(cartItem.product);
      if (!product) {
        cart.push({
          ...cartItem._doc,
          productExists: false,
          productOutOfStock: false,
        });
      } else {
        cartItem.productName = product.name;
        cartItem.productImage = product.image;
        cartItem.productPrice = product.price;
        // product? instock? or not?
        if (product.numberInStock < cartItem.quantity) {
          cart.push({
            ...cartItem._doc,
            productExists: true,
            productOutOfStock: true,
          });
        }
        cart.push({
          ...cartItem._doc,
          productExists: true,
          productOutOfStock: false,
        });
      }
    }
    return res.status(201).json(cart);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
exports.addToCart = async function (req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const productId = req.body.productID;
    const user = await userModel.findById(req.params.id);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: "user not found" });
    }
    const cartItems = await cartItem.find({ _id: { $in: user.cart } });
    const existingCartItem = cartItems.find(
      (item) =>
        item.product.equals(new mongoose.Schema.Types.ObjectId(productId)) &&
        item.selectedSize === req.body.selectedSize &&
        item.selectedColor === req.body.selectedColor
    );
    const product = await productModel.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "product does not exist",
      });
    }
    if (existingCartItem) {
      // first check the amount availabale in the stcok
      if (product.numberInStock > existingCartItem.quantity + 1) {
        existingCartItem.quantity += 1;
        await existingCartItem.save({ session });
        // decrease the amount of the poduct in the stock
        await productModel
          .findOneAndUpdate(
            {
              _id: productId,
            },
            { $inc: { numberInStock: -1 } }
          )
          .session(session);
        await session.commitTransaction();
        return res.status(201).end();
      }
      await session.abortTransaction();
      return ress.status(400).json({
        message: "product is out of stock ",
      });
    }
    // create a new cartItem
    const { selectedColor, selectedSize, quantity } = req.body;
    const newCartItem = await new CartItem({
      product: productId,
      productName: product.name,
      productImage: product.image,
      productPrice: product.price,
      selectedColor,
      selectedSize,
      quantity,
    }).save({ session });
    if (!newCartItem) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "could not create your cart item ",
      });
    }
    user.cart.push(newCartItem._id);
    await user.save({ session });
    if (!user) {
      await session.abortTransaction();
      return res.status(500).json({
        message: "could not save the user",
      });
    }
    // now check if the product in teh cart is out of stock or not
    const updatedProduct = await productModel.findOneAndUpdate(
      {
        _id: productId,
        numberInStock: { $gte: newCartItem.quantity },
      },
      {
        $inc: { numberInStock: -newCartItem.quantity },
      },
      {
        new: true,
      }
    );
    if (!updatedProduct) {
      await session.abortTransaction();
      return res.status(500).json({
        message: "product out of stock or concurrency problem",
      });
    }
    // now commit and finish the transaction
    await session.commitTransaction();
    return res.status(201).json(newCartItem);
  } catch (error) {
    console.error(error);
    await session.abortTransaction();
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};
exports.modifyQuantity = async function (req, res) {
  try {
    const user = await userModel.findById(req.body.id);
    const quantity = req.body.quantity;
    if (!user) {
      res.status(404).json({
        message: "The user does not exist",
      });
    }
    // check if the cartItem does exist
    const newCartItem = await cartItem.findById(req.body.cartItemId);
    if (!newCartItem) {
      return res.status(404).json({
        message: "cart item does not exist",
      });
    }
    // find the actual product
    const actualProduct = await productModel.findById(newCartItem.product);
    if (!actualProduct) {
      return res.status(404).json({
        message: "the product of the cart item does not exist",
      });
    }
    if (quantity > actualProduct.numberInStock) {
      return res.status(500).json({
        message:
          "you can not add this amount of  quantity in your cart cause it is out of stock",
      });
    }
    const updatedCart = await cartItem.findByIdAndUpdate(
      req.body.cartItemId,
      quantity,
      { new: true }
    );
    if (!updatedCart) {
      res.status(500).json({
        message: "could not update the quantity ",
      });
    }
    // update the numberInStock of the original product
    // const updatedProduct = await productModel.findOneAndUpdate(
    //   {
    //     _id: updatedCart.product,
    //   },
    //   {}
    // );
    return res.json(updatedCart);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
exports.removeFromCart = async function (req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // first check if the user and the cart item do exist
    const user = await userModel.findById(req.params.id);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "The user does not exist",
      });
    }
    // check if the cart item is in the user's cart
    if (!user.cart.includes(req.body.cartItemId)) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "The cart item does not exist in the user's cart ",
      });
    }
    const cartItemToBeRemoved = await cartItem.findById(req.params.cartItemId);
    if (!cartItemToBeRemoved) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "The cart item does not exist",
      });
    }
    // update the Number in stock if hte product is reserved
    if (cartItemToBeRemoved.reserved) {
      const updatedProduct = await productModel.findOneAndUpdate(
        {
          _id: cartItemToBeRemoved.product,
        },
        {
          $inc: {
            numberInStock: cartItemToBeRemoved.quantity,
          },
        },
        {
          new: true,
          session,
        }
      );
      if (!updatedProduct) {
        await session.abortTransaction();
        return res.status(404).json({
          message: "could not find the product",
        });
      }
    }
    //
    user.cart.pull(cartItemToBeRemoved._id);
    await user.save(session);
    const deletedCartItem = await cartItem
      .findByIdAndDelete(cartItemToBeRemoved._id)
      .session(session);
    if (!deletedCartItem) {
      await session.abortTransaction();
      return res.status(500).json({
        message: "Internal server erorr",
      });
    }
    await session.commitTransaction();
    return res.status(204).json({ cartItemToBeRemoved });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};
exports.getUserCartCount = async function (req, res) {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        message: " the user does not exist",
      });
    }
    const cartCount = user.cart.length; 
    return res.status(204).json(cartCount); 
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message,
      type: error.name,
    });
  }
};
