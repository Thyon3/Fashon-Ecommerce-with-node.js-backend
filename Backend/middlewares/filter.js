class Filter {
  static middleware(allowedFields = []) {
    return (req, res, next) => {
      const filters = {};
      
      allowedFields.forEach(field => {
        if (req.query[field]) {
          filters[field] = req.query[field];
        }
      });

      // Handle range filters
      allowedFields.forEach(field => {
        const minField = `${field}_min`;
        const maxField = `${field}_max`;
        
        if (req.query[minField] || req.query[maxField]) {
          filters[field] = {};
          
          if (req.query[minField]) {
            filters[field].$gte = req.query[minField];
          }
          
          if (req.query[maxField]) {
            filters[field].$lte = req.query[maxField];
          }
        }
      });

      // Handle search
      if (req.query.search) {
        filters.$text = { $search: req.query.search };
      }

      req.filter = filters;
      next();
    };
  }

  static response(data, filter) {
    return {
      success: true,
      data,
      meta: {
        filteredBy: Object.keys(filter).length > 0 ? filter : null
      }
    };
  }

  static dateRange(field = 'createdAt') {
    return (req, res, next) => {
      const { startDate, endDate } = req.query;
      const filters = {};

      if (startDate || endDate) {
        filters[field] = {};
        
        if (startDate) {
          filters[field].$gte = new Date(startDate);
        }
        
        if (endDate) {
          filters[field].$lte = new Date(endDate);
        }
      }

      req.filter = { ...req.filter, ...filters };
      next();
    };
  }
}

module.exports = Filter;
