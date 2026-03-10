class Sort {
  static middleware(defaultSort = '-createdAt') {
    return (req, res, next) => {
      const sortBy = req.query.sort || defaultSort;
      const sortField = sortBy.startsWith('-') ? sortBy.substring(1) : sortBy;
      const sortOrder = sortBy.startsWith('-') ? -1 : 1;

      req.sort = {
        field: sortField,
        order: sortOrder,
        mongo: { [sortField]: sortOrder }
      };

      next();
    };
  }

  static response(data, sort) {
    return {
      success: true,
      data,
      meta: {
        sortedBy: `${sort.order === -1 ? '-' : ''}${sort.field}`
      }
    };
  }

  static allowed(fields) {
    return (req, res, next) => {
      const sortBy = req.query.sort;
      
      if (sortBy) {
        const sortField = sortBy.startsWith('-') ? sortBy.substring(1) : sortBy;
        
        if (!fields.includes(sortField)) {
          return res.status(400).json({
            success: false,
            error: `Invalid sort field. Allowed fields: ${fields.join(', ')}`
          });
        }
      }
      
      next();
    };
  }
}

module.exports = Sort;
