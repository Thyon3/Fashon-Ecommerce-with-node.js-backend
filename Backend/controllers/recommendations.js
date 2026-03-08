const ProductModel = require("../models/product");
const OrderModel = require("../models/order");
const UserModel = require("../models/user");

class RecommendationEngine {
  // Get personalized recommendations for a user
  static async getPersonalizedRecommendations(userId, limit = 10) {
    try {
      // Get user's order history
      const userOrders = await OrderModel.find({ user: userId })
        .populate('orderItem.product')
        .sort({ dateOrdered: -1 })
        .limit(10);

      // Get user's wishlist
      const user = await UserModel.findById(userId);
      const wishlistItems = user.wishlist || [];

      // Extract product preferences
      const purchasedProducts = [];
      const purchasedCategories = new Set();
      const viewedProducts = new Set();

      userOrders.forEach(order => {
        order.orderItem.forEach(item => {
          if (item.product) {
            purchasedProducts.push(item.product._id);
            if (item.product.category) {
              purchasedCategories.add(item.product.category.toString());
            }
          }
        });
      });

      wishlistItems.forEach(item => {
        viewedProducts.add(item.productId);
        if (item.productCategory) {
          purchasedCategories.add(item.productCategory.toString());
        }
      });

      // Get recommendations based on different strategies
      const recommendations = await Promise.all([
        this.getCollaborativeRecommendations(purchasedProducts, limit),
        this.getContentBasedRecommendations(purchasedCategories, limit),
        this.getPopularRecommendations(limit),
        this.getSimilarProducts(purchasedProducts, limit)
      ]);

      // Combine and rank recommendations
      const allRecommendations = [
        ...recommendations[0],
        ...recommendations[1],
        ...recommendations[2],
        ...recommendations[3]
      ];

      // Remove already purchased/viewed products
      const filteredRecommendations = allRecommendations.filter(product => 
        !purchasedProducts.includes(product._id) && 
        !viewedProducts.has(product._id.toString())
      );

      // Remove duplicates and limit results
      const uniqueRecommendations = Array.from(
        new Map(filteredRecommendations.map(p => [p._id.toString(), p]))
      ).values();

      return uniqueRecommendations.slice(0, limit);

    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  // Collaborative filtering recommendations
  static async getCollaborativeRecommendations(purchasedProducts, limit = 10) {
    try {
      // Find users who purchased similar products
      const similarUsers = await OrderModel.aggregate([
        { $unwind: '$orderItem' },
        { $match: { 'orderItem.product': { $in: purchasedProducts } } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      if (similarUsers.length === 0) {
        return [];
      }

      const similarUserIds = similarUsers.map(u => u._id);

      // Get products purchased by similar users but not by current user
      const recommendedProducts = await OrderModel.aggregate([
        { $match: { user: { $in: similarUserIds } } },
        { $unwind: '$orderItem' },
        { $match: { 'orderItem.product': { $nin: purchasedProducts } } },
        { $group: { 
          _id: '$orderItem.product', 
          count: { $sum: 1 },
          users: { $addToSet: '$user' }
        }},
        { $sort: { count: -1 } },
        { $limit: limit },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' }},
        { $unwind: '$product' },
        { $match: { 'product.isAvailable': true } },
        { $project: {
          _id: '$product._id',
          name: '$product.name',
          price: '$product.price',
          image: '$product.image',
          rating: '$product.rating',
          category: '$product.category',
          score: { $multiply: ['$count', 10] }
        }}
      ]);

      return recommendedProducts;

    } catch (error) {
      console.error('Error in collaborative filtering:', error);
      return [];
    }
  }

  // Content-based recommendations
  static async getContentBasedRecommendations(purchasedCategories, limit = 10) {
    try {
      if (purchasedCategories.size === 0) {
        return [];
      }

      // Get products from the same categories
      const categoryArray = Array.from(purchasedCategories);
      
      const recommendedProducts = await ProductModel.find({
        category: { $in: categoryArray },
        isAvailable: true,
        _id: { $nin: purchasedCategories } // Exclude already purchased products
      })
      .populate('category', 'name')
      .sort({ rating: -1, numberInStock: -1 })
      .limit(limit);

      return recommendedProducts.map(product => ({
        _id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        rating: product.rating,
        category: product.category,
        score: product.rating * 10
      }));

    } catch (error) {
      console.error('Error in content-based filtering:', error);
      return [];
    }
  }

  // Popular products recommendations
  static async getPopularRecommendations(limit = 10) {
    try {
      const popularProducts = await ProductModel.find({
        isAvailable: true,
        isFeatured: true
      })
      .populate('category', 'name')
      .sort({ rating: -1, numberInStock: -1 })
      .limit(limit);

      return popularProducts.map(product => ({
        _id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        rating: product.rating,
        category: product.category,
        score: product.rating * 8 + (product.numberInStock / 10)
      }));

    } catch (error) {
      console.error('Error getting popular recommendations:', error);
      return [];
    }
  }

  // Similar products recommendations
  static async getSimilarProducts(purchasedProducts, limit = 10) {
    try {
      if (purchasedProducts.length === 0) {
        return [];
      }

      // Get details of purchased products
      const products = await ProductModel.find({ _id: { $in: purchasedProducts } });
      
      if (products.length === 0) {
        return [];
      }

      // Find similar products based on category, price range, and attributes
      const sampleProduct = products[0];
      const priceRange = {
        min: sampleProduct.price * 0.5,
        max: sampleProduct.price * 1.5
      };

      const similarProducts = await ProductModel.find({
        _id: { $nin: purchasedProducts },
        category: sampleProduct.category,
        price: { $gte: priceRange.min, $lte: priceRange.max },
        isAvailable: true
      })
      .populate('category', 'name')
      .sort({ rating: -1 })
      .limit(limit);

      return similarProducts.map(product => ({
        _id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        rating: product.rating,
        category: product.category,
        score: product.rating * 6
      }));

    } catch (error) {
      console.error('Error getting similar products:', error);
      return [];
    }
  }

  // Get recommendations for a specific product
  static async getProductRecommendations(productId, limit = 5) {
    try {
      const product = await ProductModel.findById(productId);
      if (!product) {
        return [];
      }

      // Find products in the same category
      const recommendations = await ProductModel.find({
        _id: { $ne: productId },
        category: product.category,
        isAvailable: true
      })
      .populate('category', 'name')
      .sort({ rating: -1 })
      .limit(limit);

      return recommendations.map(p => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        image: p.image,
        rating: p.rating,
        category: p.category,
        score: p.rating * 10
      }));

    } catch (error) {
      console.error('Error getting product recommendations:', error);
      return [];
    }
  }

  // Get trending products
  static async getTrendingProducts(limit = 10, timeRange = '7d') {
    try {
      const now = new Date();
      let startDate;

      switch (timeRange) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      // Get products with most orders in the time range
      const trendingProducts = await OrderModel.aggregate([
        { $match: { dateOrdered: { $gte: startDate } } },
        { $unwind: '$orderItem' },
        { $group: { 
          _id: '$orderItem.product', 
          orderCount: { $sum: 1 },
          totalQuantity: { $sum: '$orderItem.quantity' }
        }},
        { $sort: { orderCount: -1, totalQuantity: -1 } },
        { $limit: limit },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' }},
        { $unwind: '$product' },
        { $match: { 'product.isAvailable': true } },
        { $project: {
          _id: '$product._id',
          name: '$product.name',
          price: '$product.price',
          image: '$product.image',
          rating: '$product.rating',
          category: '$product.category',
          orderCount: 1,
          totalQuantity: 1,
          score: { $multiply: ['$orderCount', 10] }
        }}
      ]);

      return trendingProducts;

    } catch (error) {
      console.error('Error getting trending products:', error);
      return [];
    }
  }

  // Get frequently bought together products
  static async getFrequentlyBoughtTogether(productId, limit = 5) {
    try {
      // Find orders that contain the target product
      const ordersWithProduct = await OrderModel.aggregate([
        { $unwind: '$orderItem' },
        { $match: { 'orderItem.product': productId } },
        { $group: { _id: '$_id' } }
      ]);

      const orderIds = ordersWithProduct.map(o => o._id);

      if (orderIds.length === 0) {
        return [];
      }

      // Find other products frequently bought with this product
      const frequentlyBought = await OrderModel.aggregate([
        { $match: { _id: { $in: orderIds } } },
        { $unwind: '$orderItem' },
        { $match: { 'orderItem.product': { $ne: productId } } },
        { $group: { 
          _id: '$orderItem.product', 
          frequency: { $sum: 1 },
          totalQuantity: { $sum: '$orderItem.quantity' }
        }},
        { $sort: { frequency: -1, totalQuantity: -1 } },
        { $limit: limit },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' }},
        { $unwind: '$product' },
        { $match: { 'product.isAvailable': true } },
        { $project: {
          _id: '$product._id',
          name: '$product.name',
          price: '$product.price',
          image: '$product.image',
          rating: '$product.rating',
          category: '$product.category',
          frequency: 1,
          totalQuantity: 1,
          score: { $multiply: ['$frequency', 5] }
        }}
      ]);

      return frequentlyBought;

    } catch (error) {
      console.error('Error getting frequently bought together:', error);
      return [];
    }
  }
}

module.exports = RecommendationEngine;
