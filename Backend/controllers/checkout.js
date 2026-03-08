const UserModel = require("../models/user");
const OrderModel = require("../models/order");
const OrderItemModel = require("../models/order_item");
const CartItemModel = require("../models/cart_item");
const ProductModel = require("../models/product");
const mongoose = require("mongoose");

exports.createCheckout = async function (req, res) {
  try {
    const userId = req.body.user || req.params.id;
    const { shippingAddress, paymentMethod, notes } = req.body;

    // Validate user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Get user's cart items
    const cartItems = await CartItemModel.find({
      _id: { $in: user.cart },
    });

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        message: "Cart is empty",
      });
    }

    // Validate stock and calculate total
    let totalPrice = 0;
    let orderItems = [];
    
    for (const cartItem of cartItems) {
      const product = await ProductModel.findById(cartItem.product);
      
      if (!product) {
        return res.status(400).json({
          message: `Product with ID ${cartItem.product} not found`,
        });
      }

      if (product.numberInStock < cartItem.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for product: ${product.name}`,
        });
      }

      // Create order item
      const orderItem = new OrderItemModel({
        quantity: cartItem.quantity,
        product: cartItem.product,
        price: product.price,
      });
      
      const savedOrderItem = await orderItem.save();
      orderItems.push(savedOrderItem._id);
      
      // Update product stock
      await ProductModel.findByIdAndUpdate(cartItem.product, {
        $inc: { numberInStock: -cartItem.quantity },
      });

      totalPrice += product.price * cartItem.quantity;
    }

    // Create order
    const order = new OrderModel({
      orderItem: orderItems,
      shippingAddress: shippingAddress || `${user.street}, ${user.city}, ${user.country}`,
      country: user.country,
      city: user.city,
      postalCode: user.postalCode,
      phone: user.phone,
      paymentMethod: paymentMethod || "cash_on_delivery",
      user: userId,
      totalPrice: totalPrice,
      notes: notes,
    });

    const savedOrder = await order.save();

    // Clear user's cart
    await UserModel.findByIdAndUpdate(userId, {
      $unset: { cart: 1 },
    });

    // Delete cart items
    await CartItemModel.deleteMany({
      _id: { $in: cartItems.map(item => item._id) },
    });

    return res.status(201).json({
      message: "Order created successfully",
      order: savedOrder,
    });

  } catch (error) {
    console.error("Checkout error:", error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};

exports.getCheckoutDetails = async function (req, res) {
  try {
    const userId = req.params.id;
    
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const cartItems = await CartItemModel.find({
      _id: { $in: user.cart },
    }).populate('product');

    let totalPrice = 0;
    let checkoutItems = [];

    for (const cartItem of cartItems) {
      if (!cartItem.product) {
        continue; // Skip items with deleted products
      }

      const itemTotal = cartItem.product.price * cartItem.quantity;
      totalPrice += itemTotal;

      checkoutItems.push({
        cartItemId: cartItem._id,
        product: {
          id: cartItem.product._id,
          name: cartItem.product.name,
          image: cartItem.product.image,
          price: cartItem.product.price,
        },
        quantity: cartItem.quantity,
        itemTotal: itemTotal,
        inStock: cartItem.product.numberInStock >= cartItem.quantity,
      });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: {
          street: user.street,
          apartment: user.apartment,
          city: user.city,
          postalCode: user.postalCode,
          country: user.country,
        },
      },
      cartItems: checkoutItems,
      totalPrice: totalPrice,
      itemCount: checkoutItems.length,
    });

  } catch (error) {
    console.error("Get checkout details error:", error);
    return res.status(500).json({
      type: error.name,
      message: error.message,
    });
  }
};
