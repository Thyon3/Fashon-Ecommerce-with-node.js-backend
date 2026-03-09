const ProductModel = require("../models/product");

class ProductComparison {
  // Compare multiple products
  static async compareProducts(productIds) {
    try {
      if (!Array.isArray(productIds) || productIds.length < 2 || productIds.length > 5) {
        throw new Error('Please provide 2-5 products to compare');
      }

      // Get product details
      const products = await ProductModel.find({
        _id: { $in: productIds },
        isAvailable: true
      })
      .populate('category', 'name')
      .sort({ price: 1 });

      if (products.length === 0) {
        throw new Error('No products found for comparison');
      }

      // Generate comparison data
      const comparison = this.generateComparisonData(products);

      return {
        success: true,
        products: comparison.products,
        comparison: comparison.comparison,
        summary: comparison.summary,
        recommendations: comparison.recommendations
      };

    } catch (error) {
      console.error('Product comparison error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate comparison data
  static generateComparisonData(products) {
    const features = this.extractComparableFeatures(products);
    const comparison = {
      products: products.map(product => ({
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category ? product.category.name : 'Unknown',
        features: features[product._id] || {}
      })),
      featureComparison: this.compareFeatures(products, features),
      priceComparison: this.comparePrices(products),
      ratingComparison: this.compareRatings(products)
    };

    comparison.summary = this.generateComparisonSummary(comparison);
    comparison.recommendations = this.generateRecommendations(comparison);

    return comparison;
  }

  // Extract comparable features
  static extractComparableFeatures(products) {
    const features = {};
    
    products.forEach(product => {
      features[product._id] = {
        price: product.price,
        rating: product.rating || 0,
        numberInStock: product.numberInStock || 0,
        colors: product.Colors || [],
        sizes: product.sizes || [],
        material: product.material || 'Unknown',
        brand: product.brand || 'Unknown',
        genderAgeCategory: product.genderAgeCategory || 'Unisex',
        isFeatured: product.isFeatured || false,
        discountPercentage: product.discountPercentage || 0,
        weight: product.weight || 'Unknown',
        dimensions: {
          length: product.length || 'Unknown',
          width: product.width || 'Unknown',
          height: product.height || 'Unknown'
        }
      };
    });

    return features;
  }

  // Compare features across products
  static compareFeatures(products, features) {
    const featureNames = new Set();
    
    // Collect all feature names
    Object.values(features).forEach(productFeatures => {
      Object.keys(productFeatures).forEach(feature => {
        featureNames.add(feature);
      });
    });

    const comparison = {};
    
    featureNames.forEach(featureName => {
      comparison[featureName] = {
        name: this.formatFeatureName(featureName),
        values: products.map(product => ({
          productId: product._id,
          value: features[product._id] && features[product._id][featureName] !== undefined 
            ? features[product._id][featureName] 
            : 'N/A',
          isAdvantageous: this.isFeatureAdvantageous(products, featureName, features)
        }))
      };
    });

    return comparison;
  }

  // Compare prices
  static comparePrices(products) {
    const prices = products.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;

    return {
      lowest: {
        price: minPrice,
        productIds: products.filter(p => p.price === minPrice).map(p => p._id)
      },
      highest: {
        price: maxPrice,
        productIds: products.filter(p => p.price === maxPrice).map(p => p._id)
      },
      average: avgPrice,
      range: maxPrice - minPrice,
      savings: {
        bestValue: maxPrice - minPrice,
        percentage: ((maxPrice - minPrice) / maxPrice * 100).toFixed(1)
      }
    };
  }

  // Compare ratings
  static compareRatings(products) {
    const ratings = products.map(p => p.rating || 0);
    const validRatings = ratings.filter(r => r > 0);
    
    if (validRatings.length === 0) {
      return {
        highest: { rating: 0, productIds: [] },
        lowest: { rating: 0, productIds: [] },
        average: 0
      };
    }

    const maxRating = Math.max(...validRatings);
    const minRating = Math.min(...validRatings);
    const avgRating = validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length;

    return {
      highest: {
        rating: maxRating,
        productIds: products.filter(p => (p.rating || 0) === maxRating).map(p => p._id)
      },
      lowest: {
        rating: minRating,
        productIds: products.filter(p => (p.rating || 0) === minRating).map(p => p._id)
      },
      average: avgRating.toFixed(1)
    };
  }

  // Check if feature is advantageous
  static isFeatureAdvantageous(products, featureName, features) {
    const values = products.map(product => {
      const value = features[product._id] && features[product._id][featureName];
      return { productId: product._id, value };
    });

    // Define advantage criteria based on feature type
    const advantageCriteria = {
      price: (value) => typeof value === 'number' && value <= Math.min(...values.map(v => v.value)),
      rating: (value) => typeof value === 'number' && value >= Math.max(...values.map(v => v.value)),
      numberInStock: (value) => typeof value === 'number' && value >= 10,
      isFeatured: (value) => value === true,
      discountPercentage: (value) => typeof value === 'number' && value > 0,
      colors: (value) => Array.isArray(value) && value.length >= 3,
      sizes: (value) => Array.isArray(value) && value.length >= 5
    };

    const criteria = advantageCriteria[featureName] || (() => false);

    return values.map(item => ({
      ...item,
      isAdvantageous: criteria ? criteria(item.value) : false
    }));
  }

  // Format feature name for display
  static formatFeatureName(featureName) {
    const nameMap = {
      price: 'Price',
      rating: 'Rating',
      numberInStock: 'Stock Quantity',
      colors: 'Available Colors',
      sizes: 'Available Sizes',
      material: 'Material',
      brand: 'Brand',
      genderAgeCategory: 'Category',
      isFeatured: 'Featured Product',
      discountPercentage: 'Discount',
      weight: 'Weight',
      dimensions: 'Dimensions',
      length: 'Length',
      width: 'Width',
      height: 'Height'
    };

    return nameMap[featureName] || featureName;
  }

  // Generate comparison summary
  static generateComparisonSummary(comparison) {
    const { products, priceComparison, ratingComparison } = comparison;
    
    return {
      totalProducts: products.length,
      priceRange: `$${priceComparison.lowest.price} - $${priceComparison.highest.price}`,
      averagePrice: `$${priceComparison.average.toFixed(2)}`,
      bestValue: priceComparison.lowest.productIds,
      highestRated: ratingComparison.highest.productIds,
      lowestRated: ratingComparison.lowest.productIds,
      availableFeatures: Object.keys(comparison.featureComparison).length,
      stockStatus: {
        inStock: products.filter(p => p.numberInStock > 0).length,
        outOfStock: products.filter(p => p.numberInStock === 0).length,
        lowStock: products.filter(p => p.numberInStock > 0 && p.numberInStock <= 5).length
      }
    };
  }

  // Generate recommendations
  static generateRecommendations(comparison) {
    const { products, priceComparison, ratingComparison } = comparison;
    
    const recommendations = [];

    // Best value recommendation
    if (priceComparison.lowest.productIds.length > 0) {
      recommendations.push({
        type: 'best_value',
        title: 'Best Value',
        description: 'Lowest price among compared products',
        productIds: priceComparison.lowest.productIds,
        score: 10
      });
    }

    // Highest rated recommendation
    if (ratingComparison.highest.rating > 0) {
      recommendations.push({
        type: 'highest_rated',
        title: 'Highest Rated',
        description: 'Best customer reviews and ratings',
        productIds: ratingComparison.highest.productIds,
        score: ratingComparison.highest.rating
      });
    }

    // Balanced recommendation (good rating + reasonable price)
    const balancedProducts = products.filter(p => {
      const rating = p.rating || 0;
      const priceScore = this.calculatePriceScore(p.price, priceComparison);
      return rating >= 3.5 && priceScore >= 5;
    });

    if (balancedProducts.length > 0) {
      recommendations.push({
        type: 'balanced_choice',
        title: 'Balanced Choice',
        description: 'Good balance of price and quality',
        productIds: balancedProducts.map(p => p._id),
        score: 8
      });
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }

  // Calculate price score (0-10)
  static calculatePriceScore(price, priceComparison) {
    const { lowest, highest } = priceComparison;
    const range = highest.price - lowest.price;
    
    if (range === 0) return 5;
    
    const position = (highest.price - price) / range;
    return Math.max(0, Math.min(10, (1 - position) * 10));
  }

  // Get comparison statistics
  static async getComparisonStats(productId) {
    try {
      const product = await ProductModel.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Get products in same category
      const categoryProducts = await ProductModel.find({
        category: product.category,
        isAvailable: true,
        _id: { $ne: productId }
      })
      .sort({ rating: -1 })
      .limit(10);

      const prices = categoryProducts.map(p => p.price);
      const avgPrice = prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
      
      const stats = {
        product: {
          id: product._id,
          name: product.name,
          price: product.price,
          rating: product.rating || 0
        },
        category: {
          name: product.category ? product.category.name : 'Unknown',
          totalProducts: categoryProducts.length + 1
        },
        pricePosition: prices.length > 0 ? {
          rank: prices.filter(p => p.price < product.price).length + 1,
          percentile: ((prices.filter(p => p.price < product.price).length / (prices.length + 1)) * 100).toFixed(1),
          belowAverage: product.price < avgPrice
        } : null,
        ratingPosition: categoryProducts.length > 0 ? {
          rank: categoryProducts.filter(p => (p.rating || 0) > (product.rating || 0)).length + 1,
          aboveAverage: (product.rating || 0) > (categoryProducts.reduce((sum, p) => sum + (p.rating || 0), 0) / categoryProducts.length)
        } : null
      };

      return stats;

    } catch (error) {
      console.error('Comparison stats error:', error);
      throw error;
    }
  }
}

module.exports = ProductComparison;
