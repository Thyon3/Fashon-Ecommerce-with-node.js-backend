const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

class Swagger {
  static options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Fashon E-commerce API',
        version: '1.0.0',
        description: 'Production-ready e-commerce backend API with comprehensive features for authentication, product management, orders, payments, and more.',
        contact: {
          name: 'API Support',
          email: 'support@fashon.com',
          url: 'https://fashon.com/support'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: process.env.API_URL || 'http://localhost:3000',
          description: 'Development server'
        },
        {
          url: 'https://api.fashon.com',
          description: 'Production server'
        },
        {
          url: 'https://staging-api.fashon.com',
          description: 'Staging server'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT authentication token'
          }
        },
        schemas: {
          User: {
            type: 'object',
            required: ['name', 'email', 'password'],
            properties: {
              id: {
                type: 'string',
                description: 'User ID',
                example: '507f1f77bcf86cd799439011'
              },
              name: {
                type: 'string',
                description: 'User full name',
                example: 'John Doe',
                minLength: 2,
                maxLength: 50
              },
              email: {
                type: 'string',
                format: 'email',
                description: 'User email address',
                example: 'john.doe@example.com'
              },
              password: {
                type: 'string',
                format: 'password',
                description: 'User password',
                minLength: 8,
                writeOnly: true
              },
              phone: {
                type: 'string',
                description: 'User phone number',
                example: '+1234567890'
              },
              isAdmin: {
                type: 'boolean',
                description: 'Admin status',
                default: false
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'Account creation date'
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
                description: 'Last update date'
              }
            }
          },
          Product: {
            type: 'object',
            required: ['name', 'price', 'category'],
            properties: {
              id: {
                type: 'string',
                description: 'Product ID',
                example: '507f1f77bcf86cd799439011'
              },
              name: {
                type: 'string',
                description: 'Product name',
                example: 'Summer T-Shirt',
                minLength: 1,
                maxLength: 100
              },
              description: {
                type: 'string',
                description: 'Product description',
                example: 'Comfortable cotton t-shirt perfect for summer',
                maxLength: 1000
              },
              price: {
                type: 'number',
                format: 'float',
                description: 'Product price',
                example: 29.99,
                minimum: 0
              },
              category: {
                type: 'string',
                description: 'Product category',
                example: 'clothing'
              },
              images: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Product image URLs'
              },
              colors: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Available colors',
                example: ['red', 'blue', 'black']
              },
              sizes: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Available sizes',
                example: ['S', 'M', 'L', 'XL']
              },
              stock: {
                type: 'integer',
                description: 'Stock quantity',
                example: 100,
                minimum: 0
              },
              rating: {
                type: 'number',
                format: 'float',
                description: 'Average rating',
                example: 4.5,
                minimum: 0,
                maximum: 5
              },
              reviews: {
                type: 'integer',
                description: 'Number of reviews',
                example: 25,
                minimum: 0
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'Product creation date'
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
                description: 'Last update date'
              }
            }
          },
          Order: {
            type: 'object',
            required: ['items', 'shippingAddress', 'totalPrice'],
            properties: {
              id: {
                type: 'string',
                description: 'Order ID',
                example: '507f1f77bcf86cd799439011'
              },
              items: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/OrderItem'
                },
                description: 'Order items'
              },
              shippingAddress: {
                $ref: '#/components/schemas/Address'
              },
              contactInfo: {
                type: 'object',
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'john.doe@example.com'
                  },
                  phone: {
                    type: 'string',
                    example: '+1234567890'
                  }
                }
              },
              paymentId: {
                type: 'string',
                description: 'Payment transaction ID',
                example: 'pay_1234567890'
              },
              status: {
                type: 'string',
                enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
                description: 'Order status',
                example: 'pending'
              },
              statusHistory: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'pending'
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    },
                    note: {
                      type: 'string',
                      example: 'Order placed'
                    }
                  }
                }
              },
              user: {
                type: 'string',
                description: 'User ID',
                example: '507f1f77bcf86cd799439011'
              },
              orderDate: {
                type: 'string',
                format: 'date-time',
                description: 'Order date'
              },
              totalPrice: {
                type: 'number',
                format: 'float',
                description: 'Total order price',
                example: 59.99,
                minimum: 0
              }
            }
          },
          OrderItem: {
            type: 'object',
            required: ['product', 'quantity', 'price'],
            properties: {
              product: {
                type: 'string',
                description: 'Product ID',
                example: '507f1f77bcf86cd799439011'
              },
              quantity: {
                type: 'integer',
                description: 'Item quantity',
                example: 2,
                minimum: 1
              },
              price: {
                type: 'number',
                format: 'float',
                description: 'Item price at time of order',
                example: 29.99,
                minimum: 0
              },
              size: {
                type: 'string',
                description: 'Selected size',
                example: 'M'
              },
              color: {
                type: 'string',
                description: 'Selected color',
                example: 'blue'
              }
            }
          },
          Address: {
            type: 'object',
            required: ['street', 'city', 'country', 'postalCode'],
            properties: {
              street: {
                type: 'string',
                description: 'Street address',
                example: '123 Main St'
              },
              city: {
                type: 'string',
                description: 'City',
                example: 'New York'
              },
              state: {
                type: 'string',
                description: 'State/Province',
                example: 'NY'
              },
              country: {
                type: 'string',
                description: 'Country',
                example: 'USA'
              },
              postalCode: {
                type: 'string',
                description: 'Postal/ZIP code',
                example: '10001'
              }
            }
          },
          Category: {
            type: 'object',
            required: ['name'],
            properties: {
              id: {
                type: 'string',
                description: 'Category ID',
                example: '507f1f77bcf86cd799439011'
              },
              name: {
                type: 'string',
                description: 'Category name',
                example: 'clothing',
                minLength: 1,
                maxLength: 50
              },
              icon: {
                type: 'string',
                description: 'Category icon URL',
                example: 'https://example.com/icons/clothing.png'
              },
              color: {
                type: 'string',
                description: 'Category color',
                example: '#FF5722'
              },
              image: {
                type: 'string',
                description: 'Category image URL',
                example: 'https://example.com/images/clothing.jpg'
              },
              description: {
                type: 'string',
                description: 'Category description',
                example: 'All clothing items',
                maxLength: 500
              },
              parent: {
                type: 'string',
                description: 'Parent category ID for hierarchical categories',
                example: '507f1f77bcf86cd799439012'
              },
              markForDeletion: {
                type: 'boolean',
                description: 'Soft delete flag',
                default: false
              }
            }
          },
          Review: {
            type: 'object',
            required: ['product', 'user', 'rating', 'comment'],
            properties: {
              id: {
                type: 'string',
                description: 'Review ID',
                example: '507f1f77bcf86cd799439011'
              },
              product: {
                type: 'string',
                description: 'Product ID',
                example: '507f1f77bcf86cd799439011'
              },
              user: {
                type: 'string',
                description: 'User ID',
                example: '507f1f77bcf86cd799439012'
              },
              rating: {
                type: 'integer',
                description: 'Rating (1-5)',
                example: 5,
                minimum: 1,
                maximum: 5
              },
              comment: {
                type: 'string',
                description: 'Review comment',
                example: 'Great product, highly recommended!',
                maxLength: 1000
              },
              verified: {
                type: 'boolean',
                description: 'Verified purchase',
                default: false
              },
              helpful: {
                type: 'integer',
                description: 'Number of helpful votes',
                example: 10,
                minimum: 0
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'Review creation date'
              },
              updatedAt: {
                type: 'string',
                format: 'date-time',
                description: 'Last update date'
              }
            }
          },
          Cart: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  $ref: '#/components/schemas/CartItem'
                },
                description: 'Cart items'
              },
              total: {
                type: 'number',
                format: 'float',
                description: 'Cart total',
                example: 59.99,
                minimum: 0
              },
              itemCount: {
                type: 'integer',
                description: 'Total item count',
                example: 2,
                minimum: 0
              }
            }
          },
          CartItem: {
            type: 'object',
            required: ['product', 'quantity'],
            properties: {
              product: {
                type: 'string',
                description: 'Product ID',
                example: '507f1f77bcf86cd799439011'
              },
              quantity: {
                type: 'integer',
                description: 'Item quantity',
                example: 2,
                minimum: 1
              },
              size: {
                type: 'string',
                description: 'Selected size',
                example: 'M'
              },
              color: {
                type: 'string',
                description: 'Selected color',
                example: 'blue'
              },
              addedAt: {
                type: 'string',
                format: 'date-time',
                description: 'When item was added to cart'
              }
            }
          },
          Wishlist: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Product IDs in wishlist'
              },
              count: {
                type: 'integer',
                description: 'Number of items in wishlist',
                example: 5,
                minimum: 0
              }
            }
          },
          Error: {
            type: 'object',
            required: ['error', 'message'],
            properties: {
              success: {
                type: 'boolean',
                example: false
              },
              error: {
                type: 'string',
                description: 'Error type',
                example: 'ValidationError'
              },
              message: {
                type: 'string',
                description: 'Error message',
                example: 'Invalid input data'
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: {
                      type: 'string',
                      example: 'email'
                    },
                    message: {
                      type: 'string',
                      example: 'Invalid email format'
                    }
                  }
                },
                description: 'Validation error details'
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Error timestamp'
              }
            }
          },
          Success: {
            type: 'object',
            required: ['success', 'data'],
            properties: {
              success: {
                type: 'boolean',
                example: true
              },
              message: {
                type: 'string',
                description: 'Success message',
                example: 'Operation completed successfully'
              },
              data: {
                type: 'object',
                description: 'Response data'
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Response timestamp'
              }
            }
          },
          PaginatedResponse: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: true
              },
              data: {
                type: 'array',
                items: {
                  type: 'object'
                },
                description: 'Response data array'
              },
              pagination: {
                type: 'object',
                properties: {
                  page: {
                    type: 'integer',
                    example: 1,
                    minimum: 1
                  },
                  limit: {
                    type: 'integer',
                    example: 20,
                    minimum: 1,
                    maximum: 100
                  },
                  total: {
                    type: 'integer',
                    example: 100,
                    minimum: 0
                  },
                  pages: {
                    type: 'integer',
                    example: 5,
                    minimum: 0
                  },
                  hasNext: {
                    type: 'boolean',
                    example: true
                  },
                  hasPrev: {
                    type: 'boolean',
                    example: false
                  }
                }
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Response timestamp'
              }
            }
          },
          Health: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['healthy', 'unhealthy', 'degraded'],
                description: 'System health status',
                example: 'healthy'
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Health check timestamp'
              },
              uptime: {
                type: 'integer',
                description: 'System uptime in seconds',
                example: 86400
              },
              checks: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        enum: ['healthy', 'unhealthy'],
                        example: 'healthy'
                      },
                      message: {
                        type: 'string',
                        example: 'Database connected'
                      },
                      responseTime: {
                        type: 'number',
                        example: 15
                      }
                    }
                  },
                  memory: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        enum: ['healthy', 'unhealthy'],
                        example: 'healthy'
                      },
                      memory: {
                        type: 'object',
                        properties: {
                          used: {
                            type: 'string',
                            example: '256MB'
                          },
                          total: {
                            type: 'string',
                            example: '512MB'
                          }
                        }
                      }
                    }
                  },
                  disk: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        enum: ['healthy', 'unhealthy'],
                        example: 'healthy'
                      },
                      available: {
                        type: 'string',
                        example: '10GB'
                      }
                    }
                  }
                }
              }
            }
          },
          Metrics: {
            type: 'object',
            properties: {
              uptime: {
                type: 'integer',
                description: 'System uptime in seconds',
                example: 86400
              },
              requests: {
                type: 'integer',
                description: 'Total requests served',
                example: 10000
              },
              errors: {
                type: 'integer',
                description: 'Total errors encountered',
                example: 50
              },
              errorRate: {
                type: 'number',
                format: 'float',
                description: 'Error rate percentage',
                example: 0.5
              },
              averageResponseTime: {
                type: 'number',
                format: 'float',
                description: 'Average response time in milliseconds',
                example: 150
              },
              activeConnections: {
                type: 'integer',
                description: 'Current active connections',
                example: 25
              },
              memory: {
                type: 'object',
                properties: {
                  used: {
                    type: 'string',
                    example: '256MB'
                  },
                  total: {
                    type: 'string',
                    example: '512MB'
                  }
                }
              },
              cpu: {
                type: 'object',
                properties: {
                  usage: {
                    type: 'number',
                    format: 'float',
                    example: 45.5
                  }
                }
              }
            }
          },
          SearchQuery: {
            type: 'object',
            properties: {
              q: {
                type: 'string',
                description: 'Search query',
                example: 'summer dress'
              },
              category: {
                type: 'string',
                description: 'Filter by category',
                example: 'clothing'
              },
              minPrice: {
                type: 'number',
                format: 'float',
                description: 'Minimum price filter',
                example: 10
              },
              maxPrice: {
                type: 'number',
                format: 'float',
                description: 'Maximum price filter',
                example: 100
              },
              sort: {
                type: 'string',
                enum: ['relevance', 'price', 'rating', 'newest', 'oldest'],
                description: 'Sort order',
                example: 'relevance'
              },
              order: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Sort direction',
                example: 'desc'
              },
              page: {
                type: 'integer',
                description: 'Page number',
                example: 1,
                minimum: 1
              },
              limit: {
                type: 'integer',
                description: 'Results per page',
                example: 20,
                minimum: 1,
                maximum: 100
              }
            }
          }
        },
        responses: {
          BadRequest: {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          Unauthorized: {
            description: 'Unauthorized access',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          Forbidden: {
            description: 'Forbidden access',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          NotFound: {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          Conflict: {
            description: 'Resource conflict',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          TooManyRequests: {
            description: 'Rate limit exceeded',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          InternalServerError: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          Success: {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Success'
                }
              }
            }
          },
          PaginatedSuccess: {
            description: 'Successful operation with pagination',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PaginatedResponse'
                }
              }
            }
          }
        },
        parameters: {
          Page: {
            name: 'page',
            in: 'query',
            description: 'Page number',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              default: 1
            }
          },
          Limit: {
            name: 'limit',
            in: 'query',
            description: 'Number of items per page',
            required: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20
            }
          },
          Sort: {
            name: 'sort',
            in: 'query',
            description: 'Sort field',
            required: false,
            schema: {
              type: 'string'
            }
          },
          Order: {
            name: 'order',
            in: 'query',
            description: 'Sort order',
            required: false,
            schema: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc'
            }
          },
          SearchQuery: {
            name: 'q',
            in: 'query',
            description: 'Search query',
            required: false,
            schema: {
              type: 'string'
            }
          },
          Category: {
            name: 'category',
            in: 'query',
            description: 'Filter by category',
            required: false,
            schema: {
              type: 'string'
            }
          },
          MinPrice: {
            name: 'min_price',
            in: 'query',
            description: 'Minimum price filter',
            required: false,
            schema: {
              type: 'number',
              format: 'float',
              minimum: 0
            }
          },
          MaxPrice: {
            name: 'max_price',
            in: 'query',
            description: 'Maximum price filter',
            required: false,
            schema: {
              type: 'number',
              format: 'float',
              minimum: 0
            }
          },
          ProductId: {
            name: 'id',
            in: 'path',
            description: 'Product ID',
            required: true,
            schema: {
              type: 'string'
            }
          },
          OrderId: {
            name: 'id',
            in: 'path',
            description: 'Order ID',
            required: true,
            schema: {
              type: 'string'
            }
          },
          UserId: {
            name: 'id',
            in: 'path',
            description: 'User ID',
            required: true,
            schema: {
              type: 'string'
            }
          }
        }
      },
      tags: [
        {
          name: 'Authentication',
          description: 'User authentication and authorization'
        },
        {
          name: 'Users',
          description: 'User management operations'
        },
        {
          name: 'Products',
          description: 'Product management and search'
        },
        {
          name: 'Categories',
          description: 'Category management'
        },
        {
          name: 'Orders',
          description: 'Order management'
        },
        {
          name: 'Cart',
          description: 'Shopping cart operations'
        },
        {
          name: 'Wishlist',
          description: 'Wishlist operations'
        },
        {
          name: 'Reviews',
          description: 'Product reviews'
        },
        {
          name: 'Search',
          description: 'Product search and filtering'
        },
        {
          name: 'Admin',
          description: 'Administrative operations'
        },
        {
          name: 'Health',
          description: 'System health and monitoring'
        },
        {
          name: 'Analytics',
          description: 'Analytics and metrics'
        }
      ]
    },
    apis: [
      './routers/*.js',
      './controllers/*.js',
      './models/*.js'
    ]
  };

  static specs = swaggerJsdoc(this.options);

  static setup(app) {
    // Swagger UI setup
    app.use('/api-docs', swaggerUi.serve);
    app.get('/api-docs', swaggerUi.setup(this.specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Fashon API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        docExpansion: 'none',
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        displayOperationId: false,
        tryItOutEnabled: true
      }
    }));

    // JSON spec endpoint
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(this.specs);
    });

    // OpenAPI spec endpoint
    app.get('/openapi.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(this.specs);
    });

    // Redoc documentation
    app.get('/redoc', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Fashon API Documentation</title>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://cdn.jsdelivr.net/npm/redoc@2.0.0/bundles/redoc.standalone.js" rel="stylesheet">
          </head>
          <body>
            <redoc spec-url="/api-docs.json"></redoc>
            <script src="https://cdn.jsdelivr.net/npm/redoc@2.0.0/bundles/redoc.standalone.js"></script>
          </body>
        </html>
      `);
    });

    console.log('[SWAGGER] API documentation available at:');
    console.log('  - Swagger UI: /api-docs');
    console.log('  - ReDoc: /redoc');
    console.log('  - JSON Spec: /api-docs.json');
  }

  static middleware() {
    return (req, res, next) => {
      req.swaggerSpec = this.specs;

      // Add API documentation headers
      res.setHeader('X-API-Docs', '/api-docs');
      res.setHeader('X-API-Spec', '/api-docs.json');

      next();
    };
  }

  static getSpecs() {
    return this.specs;
  }

  static updateDefinition(newDefinition) {
    this.options.definition = { ...this.options.definition, ...newDefinition };
    this.specs = swaggerJsdoc(this.options);
  }

  static addTag(tag) {
    if (!this.options.definition.tags.find(t => t.name === tag.name)) {
      this.options.definition.tags.push(tag);
      this.specs = swaggerJsdoc(this.options);
    }
  }

  static addSchema(name, schema) {
    this.options.definition.components.schemas[name] = schema;
    this.specs = swaggerJsdoc(this.options);
  }

  static addPath(path, pathObject) {
    if (!this.options.definition.paths) {
      this.options.definition.paths = {};
    }
    this.options.definition.paths[path] = pathObject;
    this.specs = swaggerJsdoc(this.options);
  }

  static validateSpec() {
    const errors = [];

    // Check required components
    if (!this.options.definition.components) {
      errors.push('Missing components section');
    }

    if (!this.options.definition.components.schemas) {
      errors.push('Missing schemas section');
    }

    if (!this.options.definition.components.responses) {
      errors.push('Missing responses section');
    }

    // Check required schemas
    const requiredSchemas = ['User', 'Product', 'Order', 'Error', 'Success'];
    for (const schema of requiredSchemas) {
      if (!this.options.definition.components.schemas[schema]) {
        errors.push(`Missing required schema: ${schema}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static generatePostmanCollection() {
    const collection = {
      info: {
        name: 'Fashon API',
        description: 'Fashon E-commerce API Collection',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{JWT_TOKEN}}',
            type: 'string'
          }
        ]
      },
      variable: [
        {
          key: 'API_URL',
          value: process.env.API_URL || 'http://localhost:3000'
        },
        {
          key: 'JWT_TOKEN',
          value: ''
        }
      ],
      item: []
    };

    // Extract paths from OpenAPI spec
    const paths = this.specs.paths || {};

    for (const [path, pathItem] of Object.entries(paths)) {
      const folder = {
        name: path,
        item: []
      };

      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation === 'object' && operation.operationId) {
          const request = {
            name: operation.summary || operation.operationId,
            request: {
              method: method.toUpperCase(),
              header: [],
              url: {
                raw: '{{API_URL}}' + path,
                host: ['{{API_URL}}'],
                path: path.split('/').filter(p => p)
              },
              description: operation.description || ''
            }
          };

          // Add parameters
          if (operation.parameters) {
            for (const param of operation.parameters) {
              if (param.in === 'header') {
                request.request.header.push({
                  key: param.name,
                  value: '',
                  description: param.description
                });
              } else if (param.in === 'query') {
                request.request.url.query = request.request.url.query || [];
                request.request.url.query.push({
                  key: param.name,
                  value: '',
                  description: param.description
                });
              }
            }
          }

          // Add request body if present
          if (operation.requestBody) {
            request.request.body = {
              mode: 'raw',
              raw: JSON.stringify(operation.requestBody.content['application/json'].schema.example || {}),
              options: {
                raw: {
                  language: 'json'
                }
              }
            };
          }

          folder.item.push(request);
        }
      }

      if (folder.item.length > 0) {
        collection.item.push(folder);
      }
    }

    return collection;
  }

  static exportSpec(format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return this.specs;
      case 'yaml':
        return require('yaml').dump(this.specs);
      case 'postman':
        return this.generatePostmanCollection();
      default:
        return this.specs;
    }
  }
}

module.exports = Swagger;
