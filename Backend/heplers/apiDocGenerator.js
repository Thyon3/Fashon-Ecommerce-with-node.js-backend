const fs = require('fs');
const path = require('path');

class ApiDocGenerator {
  constructor() {
    this.docs = {
      info: {
        title: 'Fashon E-commerce API',
        version: '1.0.0',
        description: 'Comprehensive e-commerce API for Fashon platform',
        contact: {
          name: 'API Support',
          email: 'api@fashon.com'
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
        }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {}
      }
    };
  }

  // Generate documentation from routes
  generateFromRoutes(routes, app) {
    const routes = this.extractRoutes(app);
    
    routes.forEach(route => {
      const path = route.path;
      const method = route.method.toLowerCase();
      
      if (!this.docs.paths[path]) {
        this.docs.paths[path] = {};
      }
      
      this.docs.paths[path][method] = {
        summary: route.description || `${method.toUpperCase()} ${path}`,
        description: route.description || '',
        tags: route.tags || ['general'],
        parameters: this.extractParameters(route),
        responses: this.extractResponses(route),
        security: route.security || []
      };
    });
  }

  // Extract routes from Express app
  extractRoutes(app) {
    const routes = [];
    
    // This is a simplified version - in a real app, you'd use
    // a more sophisticated method to extract all routes
    return [
      {
        path: '/api/auth/login',
        method: 'POST',
        description: 'User authentication',
        tags: ['Authentication'],
        parameters: [
          {
            name: 'email',
            in: 'body',
            required: true,
            schema: { type: 'string', format: 'email' }
          },
          {
            name: 'password',
            in: 'body',
            required: true,
            schema: { type: 'string', minLength: 8 }
          }
        ],
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' }
              }
            }
          },
          '401': {
            description: 'Invalid credentials'
          }
        }
      },
      {
        path: '/api/products',
        method: 'GET',
        description: 'Get all products with pagination and filters',
        tags: ['Products'],
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer', default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page',
            schema: { type: 'integer', default: 20 }
          },
          {
            name: 'category',
            in: 'query',
            description: 'Filter by category',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Products retrieved successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProductListResponse' }
              }
            }
          }
        }
      }
    ];
  }

  // Extract parameters from route
  extractParameters(route) {
    return route.parameters || [];
  }

  // Extract responses from route
  extractResponses(route) {
    return {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      },
      '400': {
        description: 'Bad Request'
      },
      '401': {
        description: 'Unauthorized'
      },
      '404': {
        description: 'Not Found'
      },
      '500': {
        description: 'Internal Server Error'
      }
    };
  }

  // Add common schemas
  addCommonSchemas() {
    this.docs.components.schemas = {
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
          user: { $ref: '#/components/schemas/User' },
          orderItem: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
          totalPrice: { type: 'number', description: 'Order total' },
          status: { type: 'string', enum: ['pending', 'processed', 'shipped', 'delivered', 'cancelled'], description: 'Order status' },
          dateOrdered: { type: 'string', format: 'date-time', description: 'Order date' },
          shippingAddress: { type: 'string', description: 'Shipping address' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Error type' },
          message: { type: 'string', description: 'Error message' }
        }
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', description: 'Response data' },
          pagination: {
            type: 'object',
            properties: {
              currentPage: { type: 'integer' },
              totalPages: { type: 'integer' },
              totalCount: { type: 'integer' },
              hasNextPage: { type: 'boolean' },
              hasPreviousPage: { type: 'boolean' }
            }
          }
        }
      }
    };
  }

  // Add security schemes
  addSecuritySchemes() {
    this.docs.components.securitySchemes = {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication token'
      }
    };
  }

  // Generate OpenAPI specification
  generateOpenAPISpec() {
    this.addCommonSchemas();
    this.addSecuritySchemes();
    
    return JSON.stringify(this.docs, null, 2);
  }

  // Save documentation to file
  saveDocumentation(outputPath = './docs/api.json') {
    const spec = this.generateOpenAPISpec();
    
    // Ensure docs directory exists
    const docsDir = path.dirname(outputPath);
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    // Write OpenAPI spec
    fs.writeFileSync(outputPath, spec);
    
    // Generate HTML documentation
    this.generateHTMLDocs(outputPath);
    
    console.log(`API documentation generated at: ${outputPath}`);
  }

  // Generate HTML documentation
  generateHTMLDocs(jsonPath) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Fashon API Documentation</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #333; margin-bottom: 10px; }
        .endpoint { margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        .endpoint h3 { color: #0066cc; margin-bottom: 10px; }
        .method { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin-right: 10px; }
        .get { background-color: #61affe; color: white; }
        .post { background-color: #49cc90; color: white; }
        .put { background-color: #fca130; color: white; }
        .delete { background-color: #ff6b6b; color: white; }
        .parameters { margin: 15px 0; }
        .parameter { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
        .response { margin: 15px 0; }
        .response-code { font-weight: bold; color: #333; }
        .schema { background: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Fashon API Documentation</h1>
            <p>Version 1.0.0 | RESTful API for Fashon E-commerce Platform</p>
        </div>
        
        <div class="endpoint">
            <h3><span class="method get">GET</span> /api/products</h3>
            <p>Get all products with pagination and filters</p>
            
            <div class="parameters">
                <h4>Parameters</h4>
                <div class="parameter">
                    <strong>page</strong> (query) - Page number (default: 1)
                </div>
                <div class="parameter">
                    <strong>limit</strong> (query) - Items per page (default: 20)
                </div>
                <div class="parameter">
                    <strong>category</strong> (query) - Filter by category
                </div>
            </div>
            
            <div class="response">
                <h4>Response</h4>
                <div class="response-code">200 OK</div>
                <div class="schema">
{
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalCount": 200,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
                </div>
            </div>
        </div>
        
        <div class="endpoint">
            <h3><span class="method post">POST</span> /api/auth/login</h3>
            <p>User authentication</p>
            
            <div class="parameters">
                <h4>Request Body</h4>
                <div class="parameter">
                    <strong>email</strong> (required) - User email
                </div>
                <div class="parameter">
                    <strong>password</strong> (required) - User password
                </div>
            </div>
            
            <div class="response">
                <h4>Response</h4>
                <div class="response-code">200 OK</div>
                <div class="schema">
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    const htmlPath = jsonPath.replace('.json', '.html');
    fs.writeFileSync(htmlPath, html);
  }

  // Generate Postman collection
  generatePostmanCollection(outputPath = './docs/postman.json') {
    const collection = {
      info: {
        name: 'Fashon API',
        description: 'Postman collection for Fashon e-commerce API',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [
        {
          name: 'Authentication',
          item: [
            {
              name: 'Login',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json'
                  }
                ],
                body: {
                  mode: 'raw',
                  raw: JSON.stringify({
                    email: 'user@example.com',
                    password: 'password123'
                  }, null, 2)
                },
                url: {
                  raw: '{{baseUrl}}/api/auth/login'
                }
              }
            }
          ]
        },
        {
          name: 'Products',
          item: [
            {
              name: 'Get Products',
              request: {
                method: 'GET',
                url: {
                  raw: '{{baseUrl}}/api/products?page=1&limit=20'
                }
              }
            }
          ]
        }
      ]
    };
    
    // Ensure docs directory exists
    const docsDir = path.dirname(outputPath);
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));
    console.log(`Postman collection generated at: ${outputPath}`);
  }

  // Generate all documentation formats
  generateAllDocumentation() {
    console.log('Generating API documentation...');
    
    this.saveDocumentation('./docs/api.json');
    this.generatePostmanCollection('./docs/postman.json');
    
    console.log('API documentation generated successfully!');
    console.log('- OpenAPI Spec: ./docs/api.json');
    console.log('- HTML Docs: ./docs/api.html');
    console.log('- Postman Collection: ./docs/postman.json');
  }
}

// Create singleton instance
const apiDocGenerator = new ApiDocGenerator();

module.exports = apiDocGenerator;
