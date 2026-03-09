const express = require('express');
const apiDocGenerator = require('../heplers/apiDocGenerator');
const router = express.Router();

// Generate and serve API documentation
router.get('/docs', async (req, res) => {
  try {
    const docs = apiDocGenerator.generateAllDocumentation();

    res.json({
      success: true,
      data: {
        title: 'Fashon E-commerce API Documentation',
        version: '1.0.0',
        description: 'Comprehensive API documentation for Fashon e-commerce platform',
        endpoints: docs.endpoints || [],
        schemas: docs.schemas || {},
        examples: docs.examples || {}
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DOCUMENTATION_ERROR',
        message: 'Failed to generate API documentation',
        details: error.message
      }
    });
  }
});

// Serve OpenAPI specification
router.get('/docs/openapi', async (req, res) => {
  try {
    const spec = apiDocGenerator.generateOpenAPISpec();

    res.setHeader('Content-Type', 'application/json');
    res.send(spec);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'OPENAPI_ERROR',
        message: 'Failed to generate OpenAPI specification',
        details: error.message
      }
    });
  }
});

// Serve Postman collection
router.get('/docs/postman', async (req, res) => {
  try {
    apiDocGenerator.generatePostmanCollection();

    res.json({
      success: true,
      message: 'Postman collection generated successfully',
      downloadUrl: '/docs/postman.json'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'POSTMAN_ERROR',
        message: 'Failed to generate Postman collection',
        details: error.message
      }
    });
  }
});

// Download Postman collection
router.get('/docs/postman.json', (req, res) => {
  try {
    const collectionPath = './docs/postman.json';
    const fs = require('fs');

    if (fs.existsSync(collectionPath)) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="fashon-api.postman_collection.json"');
      res.sendFile(require('path').resolve(collectionPath));
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Postman collection not found'
        }
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DOWNLOAD_ERROR',
        message: 'Failed to download Postman collection',
        details: error.message
      }
    });
  }
});

// Generate HTML documentation
router.get('/docs/html', (req, res) => {
  try {
    const htmlPath = './docs/api.html';
    const fs = require('fs');

    if (fs.existsSync(htmlPath)) {
      res.sendFile(require('path').resolve(htmlPath));
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'HTML documentation not found'
        }
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'HTML_ERROR',
        message: 'Failed to serve HTML documentation',
        details: error.message
      }
    });
  }
});

// Get API endpoints list
router.get('/docs/endpoints', (req, res) => {
  try {
    const endpoints = [
      {
        path: '/api/auth/login',
        method: 'POST',
        description: 'User authentication',
        tags: ['Authentication'],
        auth: false
      },
      {
        path: '/api/auth/register',
        method: 'POST',
        description: 'User registration',
        tags: ['Authentication'],
        auth: false
      },
      {
        path: '/api/products',
        method: 'GET',
        description: 'Get all products',
        tags: ['Products'],
        auth: false
      },
      {
        path: '/api/products/:id',
        method: 'GET',
        description: 'Get product by ID',
        tags: ['Products'],
        auth: false
      },
      {
        path: '/api/orders',
        method: 'GET',
        description: 'Get user orders',
        tags: ['Orders'],
        auth: true
      },
      {
        path: '/api/orders',
        method: 'POST',
        description: 'Create new order',
        tags: ['Orders'],
        auth: true
      },
      {
        path: '/api/categories',
        method: 'GET',
        description: 'Get all categories',
        tags: ['Categories'],
        auth: false
      },
      {
        path: '/api/users/profile',
        method: 'GET',
        description: 'Get user profile',
        tags: ['Users'],
        auth: true
      },
      {
        path: '/api/health',
        method: 'GET',
        description: 'Health check endpoint',
        tags: ['System'],
        auth: false
      }
    ];

    res.json({
      success: true,
      data: {
        endpoints,
        total: endpoints.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ENDPOINTS_ERROR',
        message: 'Failed to get endpoints list',
        details: error.message
      }
    });
  }
});

// Get API schemas
router.get('/docs/schemas', (req, res) => {
  try {
    const schemas = {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'User ID' },
          name: { type: 'string', description: 'User name' },
          email: { type: 'string', format: 'email', description: 'User email' },
          phone: { type: 'string', description: 'User phone' },
          isAdmin: { type: 'boolean', description: 'Admin status' },
          createdAt: { type: 'string', format: 'date-time', description: 'Creation date' }
        }
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product ID' },
          name: { type: 'string', description: 'Product name' },
          description: { type: 'string', description: 'Product description' },
          price: { type: 'number', description: 'Product price' },
          category: { type: 'string', description: 'Product category' },
          images: { type: 'array', items: { type: 'string' }, description: 'Product images' },
          rating: { type: 'number', description: 'Product rating' },
          numberInStock: { type: 'number', description: 'Stock quantity' },
          isAvailable: { type: 'boolean', description: 'Availability status' }
        }
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' },
          user: { type: 'object', description: 'User object' },
          orderItem: { type: 'array', items: { type: 'object' }, description: 'Order items' },
          totalPrice: { type: 'number', description: 'Order total' },
          status: { type: 'string', enum: ['pending', 'processed', 'shipped', 'delivered', 'cancelled'], description: 'Order status' },
          dateOrdered: { type: 'string', format: 'date-time', description: 'Order date' },
          shippingAddress: { type: 'string', description: 'Shipping address' }
        }
      }
    };

    res.json({
      success: true,
      data: { schemas }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SCHEMAS_ERROR',
        message: 'Failed to get API schemas',
        details: error.message
      }
    });
  }
});

// Get API examples
router.get('/docs/examples', (req, res) => {
  try {
    const examples = {
      login: {
        request: {
          method: 'POST',
          url: '/api/auth/login',
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            email: 'user@example.com',
            password: 'password123'
          }
        },
        response: {
          status: 200,
          body: {
            success: true,
            data: {
              token: 'jwt_token_here',
              user: {
                id: 'user_id',
                name: 'John Doe',
                email: 'user@example.com'
              }
            }
          }
        }
      },
      getProducts: {
        request: {
          method: 'GET',
          url: '/api/products?page=1&limit=20',
          headers: {
            'Content-Type': 'application/json'
          }
        },
        response: {
          status: 200,
          body: {
            success: true,
            data: [...],
            pagination: {
              currentPage: 1,
              totalPages: 10,
              totalCount: 200
            }
          }
        }
      }
    };

    res.json({
      success: true,
      data: { examples }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'EXAMPLES_ERROR',
        message: 'Failed to get API examples',
        details: error.message
      }
    });
  }
});

module.exports = router;
