const ProductModel = require("../models/product");
const notificationService = require("../heplers/notificationService");

// Get inventory status for all products
exports.getInventoryStatus = async function (req, res) {
  try {
    const { page = 1, limit = 20, lowStockThreshold = 10, outOfStock = true } = req.query;

    // Build filter criteria
    let filterCriteria = {};
    
    if (outOfStock === 'false') {
      filterCriteria.numberInStock = { $gt: 0 };
    }

    // Get products with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const products = await ProductModel.find(filterCriteria)
      .populate('category', 'name')
      .sort({ numberInStock: 1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalCount = await ProductModel.countDocuments(filterCriteria);

    // Categorize products by stock status
    const outOfStockProducts = products.filter(p => p.numberInStock === 0);
    const lowStockProducts = products.filter(p => p.numberInStock > 0 && p.numberInStock <= parseInt(lowStockThreshold));
    const inStockProducts = products.filter(p => p.numberInStock > parseInt(lowStockThreshold));

    res.status(200).json({
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit)
      },
      summary: {
        totalProducts: products.length,
        outOfStock: outOfStockProducts.length,
        lowStock: lowStockProducts.length,
        inStock: inStockProducts.length,
        lowStockThreshold: parseInt(lowStockThreshold)
      }
    });

  } catch (error) {
    console.error('Get inventory status error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Update product stock
exports.updateStock = async function (req, res) {
  try {
    const { productId } = req.params;
    const { numberInStock, operation, quantity } = req.body;

    // Find product
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    let newStock = product.numberInStock;
    let operationType = '';

    // Calculate new stock based on operation
    switch (operation) {
      case 'add':
        newStock = product.numberInStock + parseInt(quantity);
        operationType = 'Stock Added';
        break;
      case 'subtract':
        newStock = Math.max(0, product.numberInStock - parseInt(quantity));
        operationType = 'Stock Subtracted';
        break;
      case 'set':
        newStock = parseInt(numberInStock);
        operationType = 'Stock Set';
        break;
      default:
        return res.status(400).json({
          message: "Invalid operation. Use 'add', 'subtract', or 'set'"
        });
    }

    // Check for low stock warning
    const isLowStock = newStock > 0 && newStock <= 10;
    const isOutOfStock = newStock === 0;

    // Update product
    product.numberInStock = newStock;
    product.updatedDate = new Date();
    await product.save();

    // Send notification if stock is low or out of stock
    if (isLowStock && product.numberInStock > 10) {
      await notificationService.createNotification(
        'admin', // In a real app, this would be the admin user ID
        'low_stock',
        'Low Stock Alert',
        `Product "${product.name}" is running low on stock (${newStock} remaining)`,
        {
          productId: product._id,
          productName: product.name,
          currentStock: newStock,
          sku: product.sku || 'N/A'
        }
      );
    }

    if (isOutOfStock) {
      await notificationService.createNotification(
        'admin', // In a real app, this would be the admin user ID
        'out_of_stock',
        'Out of Stock Alert',
        `Product "${product.name}" is now out of stock`,
        {
          productId: product._id,
          productName: product.name,
          sku: product.sku || 'N/A'
        }
      );
    }

    res.status(200).json({
      message: `Stock ${operationType} successfully`,
      product: {
        id: product._id,
        name: product.name,
        numberInStock: newStock,
        isLowStock: isLowStock,
        isOutOfStock: isOutOfStock,
        operationType
      }
    });

  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get low stock alerts
exports.getLowStockAlerts = async function (req, res) {
  try {
    const { threshold = 10 } = req.query;

    // Find products with low stock
    const lowStockProducts = await ProductModel.find({
      numberInStock: { $gt: 0, $lte: parseInt(threshold) },
      isAvailable: true
    })
    .populate('category', 'name')
    .sort({ numberInStock: 1, name: 1 });

    // Find out of stock products
    const outOfStockProducts = await ProductModel.find({
      numberInStock: 0,
      isAvailable: true
    })
    .populate('category', 'name')
    .sort({ name: 1 });

    res.status(200).json({
      lowStockProducts,
      outOfStockProducts,
      summary: {
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        totalAlerts: lowStockProducts.length + outOfStockProducts.length,
        threshold: parseInt(threshold)
      }
    });

  } catch (error) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Bulk update stock for multiple products
exports.bulkUpdateStock = async function (req, res) {
  try {
    const { updates } = req.body; // Array of { productId, numberInStock, operation, quantity }

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        message: "Updates array is required"
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { productId, numberInStock, operation, quantity } = update;

        // Find product
        const product = await ProductModel.findById(productId);
        if (!product) {
          errors.push({
            productId,
            error: "Product not found"
          });
          continue;
        }

        let newStock = product.numberInStock;
        let operationType = '';

        // Calculate new stock
        switch (operation) {
          case 'add':
            newStock = product.numberInStock + parseInt(quantity);
            operationType = 'Stock Added';
            break;
          case 'subtract':
            newStock = Math.max(0, product.numberInStock - parseInt(quantity));
            operationType = 'Stock Subtracted';
            break;
          case 'set':
            newStock = parseInt(numberInStock);
            operationType = 'Stock Set';
            break;
          default:
            errors.push({
              productId,
              error: "Invalid operation"
            });
            continue;
        }

        // Update product
        product.numberInStock = newStock;
        product.updatedDate = new Date();
        await product.save();

        results.push({
          productId,
          productName: product.name,
          previousStock: product.numberInStock,
          newStock: newStock,
          operationType,
          success: true
        });

      } catch (error) {
        errors.push({
          productId: update.productId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      message: "Bulk stock update completed",
      summary: {
        totalUpdates: updates.length,
        successful: results.length,
        failed: errors.length
      },
      results,
      errors
    });

  } catch (error) {
    console.error('Bulk update stock error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get inventory analytics
exports.getInventoryAnalytics = async function (req, res) {
  try {
    // Get overall inventory statistics
    const totalProducts = await ProductModel.countDocuments();
    const inStockProducts = await ProductModel.countDocuments({ numberInStock: { $gt: 0 } });
    const outOfStockProducts = await ProductModel.countDocuments({ numberInStock: 0 });
    const lowStockProducts = await ProductModel.countDocuments({ numberInStock: { $gt: 0, $lte: 10 } });

    // Get stock distribution
    const stockDistribution = await ProductModel.aggregate([
      {
        $group: {
          _id: null,
          totalStock: { $sum: '$numberInStock' },
          averageStock: { $avg: '$numberInStock' },
          maxStock: { $max: '$numberInStock' },
          minStock: { $min: '$numberInStock' }
        }
      }
    ]);

    // Get category-wise inventory
    const categoryInventory = await ProductModel.aggregate([
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          inStockProducts: {
            $sum: { $cond: [{ $gt: ['$numberInStock', 0] }, 1, 0] }
          },
          totalStock: { $sum: '$numberInStock' }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $unwind: '$categoryInfo'
      },
      {
        $project: {
          categoryName: '$categoryInfo.name',
          totalProducts: 1,
          inStockProducts: 1,
          outOfStockProducts: { $subtract: ['$totalProducts', '$inStockProducts'] },
          totalStock: 1,
          stockTurnoverRate: { $divide: ['$inStockProducts', '$totalProducts'] }
        }
      },
      { $sort: { totalStock: -1 } }
    ]);

    const stats = stockDistribution.length > 0 ? stockDistribution[0] : {};

    res.status(200).json({
      overview: {
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        lowStockProducts,
        inStockRate: totalProducts > 0 ? ((inStockProducts / totalProducts) * 100).toFixed(2) : 0,
        outOfStockRate: totalProducts > 0 ? ((outOfStockProducts / totalProducts) * 100).toFixed(2) : 0
      },
      distribution: {
        totalStock: stats.totalStock || 0,
        averageStock: Math.round(stats.averageStock || 0),
        maxStock: stats.maxStock || 0,
        minStock: stats.minStock || 0
      },
      categoryInventory
    });

  } catch (error) {
    console.error('Get inventory analytics error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};
