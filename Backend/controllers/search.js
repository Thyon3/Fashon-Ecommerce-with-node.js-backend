const ProductModel = require("../models/product");
const CategoryModel = require("../models/category");

// Search products with filters
exports.searchProducts = async function (req, res) {
  try {
    const {
      query,
      category,
      minPrice,
      maxPrice,
      sortBy = 'relevance',
      page = 1,
      limit = 20
    } = req.query;

    // Build search criteria
    let searchCriteria = {};

    // Text search
    if (query) {
      searchCriteria.$text = { $search: query };
    }

    // Category filter
    if (category) {
      searchCriteria.category = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      searchCriteria.price = {};
      if (minPrice) searchCriteria.price.$gte = parseFloat(minPrice);
      if (maxPrice) searchCriteria.price.$lte = parseFloat(maxPrice);
    }

    // Only show available products
    searchCriteria.isAvailable = true;

    // Sorting options
    let sortOptions = {};
    switch (sortBy) {
      case 'price_low':
        sortOptions.price = 1;
        break;
      case 'price_high':
        sortOptions.price = -1;
        break;
      case 'newest':
        sortOptions.createdDate = -1;
        break;
      case 'rating':
        sortOptions.rating = -1;
        break;
      case 'name':
        sortOptions.name = 1;
        break;
      default: // relevance
        if (query) {
          sortOptions = { score: { $meta: 'textScore' } };
        } else {
          sortOptions = { createdDate: -1 };
        }
    }

    // Execute search with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let searchQuery = ProductModel.find(searchCriteria);
    
    if (query && sortBy === 'relevance') {
      searchQuery = searchQuery.select({ score: { $meta: 'textScore' } });
    }
    
    const products = await searchQuery
      .populate('category', 'name color')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await ProductModel.countDocuments(searchCriteria);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPreviousPage = parseInt(page) > 1;

    res.status(200).json({
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage,
        limit: parseInt(limit)
      },
      filters: {
        query,
        category,
        minPrice,
        maxPrice,
        sortBy
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get search suggestions/autocomplete
exports.getSearchSuggestions = async function (req, res) {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(200).json({ suggestions: [] });
    }

    // Get product name suggestions
    const products = await ProductModel.find({
      name: { $regex: query, $options: 'i' },
      isAvailable: true
    })
    .select('name')
    .limit(10)
    .lean();

    // Get category suggestions
    const categories = await CategoryModel.find({
      name: { $regex: query, $options: 'i' }
    })
    .select('name')
    .limit(5)
    .lean();

    // Format suggestions
    const productSuggestions = products.map(p => ({
      type: 'product',
      text: p.name,
      highlight: p.name.replace(new RegExp(query, 'gi'), match => `<strong>${match}</strong>`)
    }));

    const categorySuggestions = categories.map(c => ({
      type: 'category',
      text: c.name,
      highlight: c.name.replace(new RegExp(query, 'gi'), match => `<strong>${match}</strong>`)
    }));

    const suggestions = [...productSuggestions, ...categorySuggestions];

    res.status(200).json({ suggestions });

  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get popular searches (could be implemented with analytics)
exports.getPopularSearches = async function (req, res) {
  try {
    // For now, return static popular searches
    // In a real app, this would come from analytics data
    const popularSearches = [
      't-shirt',
      'jeans',
      'dress',
      'shoes',
      'jacket',
      'summer',
      'formal',
      'casual',
      'sports',
      'accessories'
    ];

    res.status(200).json({ popularSearches });

  } catch (error) {
    console.error('Popular searches error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};
