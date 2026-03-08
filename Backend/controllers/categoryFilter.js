const ProductModel = require("../models/product");
const CategoryModel = require("../models/category");

// Get products by category with filters
exports.getProductsByCategory = async function (req, res) {
  try {
    const { categoryId } = req.params;
    const {
      minPrice,
      maxPrice,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
      colors,
      sizes,
      genderAgeCategory
    } = req.query;

    // Validate category exists
    const category = await CategoryModel.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        message: "Category not found"
      });
    }

    // Build filter criteria
    let filterCriteria = {
      category: categoryId,
      isAvailable: true
    };

    // Price range filter
    if (minPrice || maxPrice) {
      filterCriteria.price = {};
      if (minPrice) filterCriteria.price.$gte = parseFloat(minPrice);
      if (maxPrice) filterCriteria.price.$lte = parseFloat(maxPrice);
    }

    // Color filter
    if (colors) {
      const colorArray = Array.isArray(colors) ? colors : colors.split(',');
      filterCriteria.Colors = { $in: colorArray };
    }

    // Size filter
    if (sizes) {
      const sizeArray = Array.isArray(sizes) ? sizes : sizes.split(',');
      filterCriteria.sizes = { $in: sizeArray };
    }

    // Gender/Age category filter
    if (genderAgeCategory) {
      filterCriteria.genderAgeCategory = genderAgeCategory;
    }

    // Build sort options
    const sortOptions = {};
    const sortField = sortBy === 'price' ? 'price' : 
                     sortBy === 'rating' ? 'rating' : 
                     sortBy === 'date' ? 'createdDate' : 'name';
    sortOptions[sortField] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const products = await ProductModel.find(filterCriteria)
      .populate('category', 'name color')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalCount = await ProductModel.countDocuments(filterCriteria);

    // Get available filters for this category
    const availableColors = await ProductModel.distinct('Colors', {
      category: categoryId,
      isAvailable: true
    });

    const availableSizes = await ProductModel.distinct('sizes', {
      category: categoryId,
      isAvailable: true
    });

    const availableGenderCategories = await ProductModel.distinct('genderAgeCategory', {
      category: categoryId,
      isAvailable: true
    });

    // Get price range
    const priceRange = await ProductModel.aggregate([
      { $match: { category: categoryId, isAvailable: true } },
      { $group: { _id: null, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' } } }
    ]);

    const { minPrice: minAvailablePrice, maxPrice: maxAvailablePrice } = 
      priceRange.length > 0 ? priceRange[0] : { minPrice: 0, maxPrice: 0 };

    res.status(200).json({
      category: {
        id: category._id,
        name: category.name,
        description: category.description,
        image: category.image,
        color: category.color
      },
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
        hasPreviousPage: parseInt(page) > 1,
        limit: parseInt(limit)
      },
      filters: {
        colors: availableColors,
        sizes: availableSizes,
        genderAgeCategories: availableGenderCategories,
        priceRange: {
          min: minAvailablePrice,
          max: maxAvailablePrice
        }
      },
      appliedFilters: {
        minPrice,
        maxPrice,
        sortBy,
        sortOrder,
        colors: colors ? (Array.isArray(colors) ? colors : colors.split(',')) : [],
        sizes: sizes ? (Array.isArray(sizes) ? sizes : sizes.split(',')) : [],
        genderAgeCategory
      }
    });

  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get category with subcategories and product counts
exports.getCategoryHierarchy = async function (req, res) {
  try {
    const { categoryId } = req.params;

    // Find the main category
    const category = await CategoryModel.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        message: "Category not found"
      });
    }

    // Find subcategories
    const subcategories = await CategoryModel.find({ parentCategory: categoryId });

    // Get product counts for each category
    const categoryIds = [categoryId, ...subcategories.map(cat => cat._id)];
    const productCounts = await ProductModel.aggregate([
      { $match: { category: { $in: categoryIds }, isAvailable: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Create a map of category ID to product count
    const countMap = {};
    productCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });

    // Format response
    const response = {
      category: {
        ...category.toObject(),
        productCount: countMap[categoryId] || 0
      },
      subcategories: subcategories.map(cat => ({
        ...cat.toObject(),
        productCount: countMap[cat._id.toString()] || 0
      }))
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Get category hierarchy error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get all categories with product counts
exports.getAllCategoriesWithCounts = async function (req, res) {
  try {
    const { includeEmpty = false } = req.query;

    // Get all categories
    const categories = await CategoryModel.find({ markForDeletion: false })
      .sort({ sortOrder: 1, name: 1 });

    // Get product counts for all categories
    const productCounts = await ProductModel.aggregate([
      { $match: { isAvailable: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    // Create a map of category ID to product count
    const countMap = {};
    productCounts.forEach(item => {
      countMap[item._id.toString()] = item.count;
    });

    // Format response
    let categoriesWithCounts = categories.map(cat => ({
      ...cat.toObject(),
      productCount: countMap[cat._id.toString()] || 0
    }));

    // Filter out empty categories if requested
    if (includeEmpty === 'false') {
      categoriesWithCounts = categoriesWithCounts.filter(cat => cat.productCount > 0);
    }

    res.status(200).json({
      categories: categoriesWithCounts,
      totalCategories: categoriesWithCounts.length
    });

  } catch (error) {
    console.error('Get all categories with counts error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get featured products by category
exports.getFeaturedProductsByCategory = async function (req, res) {
  try {
    const { categoryId } = req.params;
    const { limit = 8 } = req.query;

    // Validate category exists
    const category = await CategoryModel.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        message: "Category not found"
      });
    }

    // Get featured products
    const products = await ProductModel.find({
      category: categoryId,
      isAvailable: true,
      isFeatured: true
    })
    .populate('category', 'name color')
    .sort({ rating: -1, createdDate: -1 })
    .limit(parseInt(limit));

    res.status(200).json({
      category: {
        id: category._id,
        name: category.name,
        image: category.image
      },
      products
    });

  } catch (error) {
    console.error('Get featured products by category error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};
