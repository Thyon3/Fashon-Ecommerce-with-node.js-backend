const ProductModel = require("../models/product");
const OrderModel = require("../models/order");
const UserModel = require("../models/user");

// Track product view
exports.trackProductView = async function (req, res) {
  try {
    const { productId } = req.params;
    const { userId, sessionId, deviceInfo } = req.body;

    // Find product
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    // Increment view count (in a real app, this would be stored in a separate analytics table)
    product.viewCount = (product.viewCount || 0) + 1;
    await product.save();

    // Log analytics event (in a real app, this would go to an analytics service)
    console.log(`Product View: ${productId} by ${userId || 'anonymous'} at ${new Date()}`);

    res.status(200).json({
      message: "Product view tracked successfully",
      viewCount: product.viewCount
    });

  } catch (error) {
    console.error('Track product view error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get product analytics
exports.getProductAnalytics = async function (req, res) {
  try {
    const { productId } = req.params;
    const { startDate, endDate } = req.query;

    // Find product
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    // Build date filter
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get order statistics for this product
    const orderStats = await OrderModel.aggregate([
      { $unwind: '$orderItem' },
      { $match: { 'orderItem.product': product._id } },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: { $multiply: ['$orderItem.price', '$orderItem.quantity'] } },
        totalQuantitySold: { $sum: '$orderItem.quantity' },
        averageOrderValue: { $avg: { $multiply: ['$orderItem.price', '$orderItem.quantity'] } }
      }}
    ]);

    // Get daily sales data
    const dailySales = await OrderModel.aggregate([
      { $unwind: '$orderItem' },
      { $match: { 
        'orderItem.product': product._id,
        ...(Object.keys(dateFilter).length > 0 && dateFilter)
      }},
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$dateOrdered' } },
        sales: { $sum: { $multiply: ['$orderItem.price', '$orderItem.quantity'] } },
        quantity: { $sum: '$orderItem.quantity' },
        orders: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Get top buying customers
    const topCustomers = await OrderModel.aggregate([
      { $unwind: '$orderItem' },
      { $match: { 'orderItem.product': product._id } },
      { $group: {
        _id: '$user',
        totalSpent: { $sum: { $multiply: ['$orderItem.price', '$orderItem.quantity'] } },
        quantity: { $sum: '$orderItem.quantity' },
        orders: { $sum: 1 }
      }},
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' }},
      { $unwind: '$userInfo' },
      { $project: {
        userId: '$_id',
        name: '$userInfo.name',
        email: '$userInfo.email',
        totalSpent: 1,
        quantity: 1,
        orders: 1
      }},
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    const stats = orderStats.length > 0 ? orderStats[0] : {
      totalOrders: 0,
      totalRevenue: 0,
      totalQuantitySold: 0,
      averageOrderValue: 0
    };

    res.status(200).json({
      product: {
        id: product._id,
        name: product.name,
        viewCount: product.viewCount || 0
      },
      analytics: {
        overview: stats,
        dailySales,
        topCustomers,
        conversionRate: stats.totalOrders > 0 ? ((stats.totalOrders / (product.viewCount || 1)) * 100).toFixed(2) : 0
      }
    });

  } catch (error) {
    console.error('Get product analytics error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get overall analytics dashboard
exports.getDashboardAnalytics = async function (req, res) {
  try {
    const { period = '30' } = req.query; // Default to last 30 days

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get overall statistics
    const totalProducts = await ProductModel.countDocuments({ isAvailable: true });
    const totalOrders = await OrderModel.countDocuments({
      dateOrdered: { $gte: startDate, $lte: endDate }
    });
    const totalUsers = await UserModel.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Get revenue statistics
    const revenueStats = await OrderModel.aggregate([
      { $match: { dateOrdered: { $gte: startDate, $lte: endDate } } },
      { $group: {
        _id: null,
        totalRevenue: { $sum: '$totalPrice' },
        averageOrderValue: { $avg: '$totalPrice' },
        orders: { $sum: 1 }
      }}
    ]);

    // Get top products
    const topProducts = await OrderModel.aggregate([
      { $match: { dateOrdered: { $gte: startDate, $lte: endDate } } },
      { $unwind: '$orderItem' },
      { $group: {
        _id: '$orderItem.product',
        totalRevenue: { $sum: { $multiply: ['$orderItem.price', '$orderItem.quantity'] } },
        quantity: { $sum: '$orderItem.quantity' },
        orders: { $sum: 1 }
      }},
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'productInfo' }},
      { $unwind: '$productInfo' },
      { $project: {
        productId: '$_id',
        productName: '$productInfo.name',
        productImage: '$productInfo.image',
        totalRevenue: 1,
        quantity: 1,
        orders: 1
      }},
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // Get sales by category
    const categorySales = await OrderModel.aggregate([
      { $match: { dateOrdered: { $gte: startDate, $lte: endDate } } },
      { $unwind: '$orderItem' },
      { $lookup: { from: 'products', localField: 'orderItem.product', foreignField: '_id', as: 'productInfo' }},
      { $unwind: '$productInfo' },
      { $lookup: { from: 'categories', localField: 'productInfo.category', foreignField: '_id', as: 'categoryInfo' }},
      { $unwind: '$categoryInfo' },
      { $group: {
        _id: '$categoryInfo._id',
        categoryName: { $first: '$categoryInfo.name' },
        totalRevenue: { $sum: { $multiply: ['$orderItem.price', '$orderItem.quantity'] } },
        quantity: { $sum: '$orderItem.quantity' },
        orders: { $sum: 1 }
      }},
      { $sort: { totalRevenue: -1 } }
    ]);

    // Get daily revenue
    const dailyRevenue = await OrderModel.aggregate([
      { $match: { dateOrdered: { $gte: startDate, $lte: endDate } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$dateOrdered' } },
        revenue: { $sum: '$totalPrice' },
        orders: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    const revenue = revenueStats.length > 0 ? revenueStats[0] : {
      totalRevenue: 0,
      averageOrderValue: 0,
      orders: 0
    };

    res.status(200).json({
      period: `${period} days`,
      overview: {
        totalProducts,
        totalOrders,
        totalUsers,
        totalRevenue: revenue.totalRevenue,
        averageOrderValue: revenue.averageOrderValue
      },
      topProducts,
      categorySales,
      dailyRevenue
    });

  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get user behavior analytics
exports.getUserBehaviorAnalytics = async function (req, res) {
  try {
    const { period = '30' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get user registration trends
    const userRegistrations = await UserModel.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Get user activity (orders per user)
    const userActivity = await OrderModel.aggregate([
      { $match: { dateOrdered: { $gte: startDate, $lte: endDate } } },
      { $group: {
        _id: '$user',
        orders: { $sum: 1 },
        totalSpent: { $sum: '$totalPrice' }
      }},
      { $group: {
        _id: null,
        averageOrdersPerUser: { $avg: '$orders' },
        averageSpentPerUser: { $avg: '$totalSpent' },
        totalUsers: { $sum: 1 }
      }}
    ]);

    // Get user demographics (if available)
    const userDemographics = await UserModel.aggregate([
      { $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: [{ $gte: ['$lastLogin', startDate] }, 1, 0] } },
        newUsers: { $sum: { $cond: [{ $gte: ['$createdAt', startDate] }, 1, 0] } }
      }}
    ]);

    const activity = userActivity.length > 0 ? userActivity[0] : {
      averageOrdersPerUser: 0,
      averageSpentPerUser: 0,
      totalUsers: 0
    };

    const demographics = userDemographics.length > 0 ? userDemographics[0] : {
      totalUsers: 0,
      activeUsers: 0,
      newUsers: 0
    };

    res.status(200).json({
      period: `${period} days`,
      userRegistrations,
      userActivity: activity,
      userDemographics: demographics,
      retentionRate: demographics.totalUsers > 0 ? 
        ((demographics.activeUsers / demographics.totalUsers) * 100).toFixed(2) : 0
    });

  } catch (error) {
    console.error('Get user behavior analytics error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Track search analytics
exports.trackSearch = async function (req, res) {
  try {
    const { query, filters, resultsCount, userId } = req.body;

    // Log search analytics (in a real app, this would go to an analytics service)
    console.log(`Search Query: "${query}" - Results: ${resultsCount} - User: ${userId || 'anonymous'}`);

    // In a real implementation, you would store this in a search analytics table
    // for later analysis of popular searches, search effectiveness, etc.

    res.status(200).json({
      message: "Search analytics tracked successfully"
    });

  } catch (error) {
    console.error('Track search error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get search analytics
exports.getSearchAnalytics = async function (req, res) {
  try {
    const { period = '7' } = req.query; // Default to last 7 days

    // In a real implementation, this would query a search analytics table
    // For now, return mock data
    const searchAnalytics = {
      period: `${period} days`,
      totalSearches: 1250,
      uniqueSearchers: 450,
      averageResultsPerSearch: 15.5,
      topSearchQueries: [
        { query: 't-shirt', count: 125, avgResults: 18 },
        { query: 'jeans', count: 98, avgResults: 12 },
        { query: 'dress', count: 87, avgResults: 22 },
        { query: 'shoes', count: 76, avgResults: 15 },
        { query: 'jacket', count: 65, avgResults: 8 }
      ],
      searchTrends: [
        { date: '2026-03-01', searches: 180 },
        { date: '2026-03-02', searches: 165 },
        { date: '2026-03-03', searches: 190 },
        { date: '2026-03-04', searches: 175 },
        { date: '2026-03-05', searches: 200 },
        { date: '2026-03-06', searches: 185 },
        { date: '2026-03-07', searches: 155 }
      ]
    };

    res.status(200).json(searchAnalytics);

  } catch (error) {
    console.error('Get search analytics error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};
