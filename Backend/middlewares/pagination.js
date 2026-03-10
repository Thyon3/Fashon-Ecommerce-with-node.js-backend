class Pagination {
  static middleware(defaultLimit = 10, maxLimit = 100) {
    return (req, res, next) => {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || defaultLimit, maxLimit);
      const skip = (page - 1) * limit;

      req.pagination = {
        page,
        limit,
        skip,
        getTotal: (total) => ({
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        })
      };

      next();
    };
  }

  static response(data, total, pagination) {
    return {
      success: true,
      data,
      pagination: pagination.getTotal(total),
      meta: {
        count: data.length,
        total
      }
    };
  }
}

module.exports = Pagination;
