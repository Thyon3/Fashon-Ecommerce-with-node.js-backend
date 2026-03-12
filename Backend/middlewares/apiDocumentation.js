const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class APIDocumentation extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableSwagger: options.enableSwagger !== false,
      enableReDoc: options.enableReDoc || false,
      enablePostman: options.enablePostman || false,
      enableMarkdown: options.enableMarkdown || false,
      outputPath: options.outputPath || path.join(process.cwd(), 'docs', 'api'),
      swaggerConfig: options.swaggerConfig || {
        title: 'Fashon API',
        version: '1.0.0',
        description: 'Complete API documentation for Fashon e-commerce platform',
        servers: [
          {
            url: 'http://localhost:3000/api/v1',
            description: 'Development server'
          },
          {
            url: 'https://api.fashon.com/v1',
            description: 'Production server'
          }
        ]
      },
      enableAutoDiscovery: options.enableAutoDiscovery !== false,
      enableMetrics: options.enableMetrics !== false,
      enableValidation: options.enableValidation || false,
      customTags: options.customTags || [],
      ...options
    };
    
    this.endpoints = new Map();
    this.schemas = new Map();
    this.tags = new Set();
    this.metrics = {
      endpointsDocumented: 0,
      schemasDefined: 0,
      tagsCreated: 0,
      documentationGenerated: 0,
      requestsToDocs: 0
    };
    
    this.init();
  }

  init() {
    if (this.options.enableAutoDiscovery) {
      this.setupAutoDiscovery();
    }
    
    console.log('[API_DOCUMENTATION] API documentation service initialized');
  }

  setupAutoDiscovery() {
    // This would integrate with the actual Express app to discover routes
    console.log('[API_DOCUMENTATION] Auto-discovery enabled');
  }

  addEndpoint(method, path, config) {
    const endpoint = {
      method: method.toUpperCase(),
      path,
      summary: config.summary || `${method} ${path}`,
      description: config.description || '',
      tags: config.tags || [],
      parameters: config.parameters || [],
      requestBody: config.requestBody || null,
      responses: config.responses || {},
      security: config.security || [],
      examples: config.examples || [],
      deprecated: config.deprecated || false,
      hidden: config.hidden || false,
      metadata: config.metadata || {},
      addedAt: new Date().toISOString()
    };
    
    this.endpoints.set(`${method}:${path}`, endpoint);
    
    // Add tags
    for (const tag of endpoint.tags) {
      this.tags.add(tag);
    }
    
    this.metrics.endpointsDocumented++;
    
    this.emit('endpoint:added', endpoint);
    
    return endpoint;
  }

  addSchema(name, schema) {
    const schemaDefinition = {
      name,
      type: schema.type || 'object',
      properties: schema.properties || {},
      required: schema.required || [],
      example: schema.example || null,
      description: schema.description || '',
      metadata: schema.metadata || {},
      addedAt: new Date().toISOString()
    };
    
    this.schemas.set(name, schemaDefinition);
    this.metrics.schemasDefined++;
    
    this.emit('schema:added', schemaDefinition);
    
    return schemaDefinition;
  }

  addTag(name, description) {
    const tag = {
      name,
      description,
      endpoints: Array.from(this.endpoints.values())
        .filter(endpoint => endpoint.tags.includes(name))
        .map(endpoint => `${endpoint.method} ${endpoint.path}`)
    };
    
    this.tags.add(name);
    this.metrics.tagsCreated++;
    
    this.emit('tag:added', tag);
    
    return tag;
  }

  generateSwaggerSpec() {
    const spec = {
      openapi: '3.0.0',
      info: {
        title: this.options.swaggerConfig.title,
        version: this.options.swaggerConfig.version,
        description: this.options.swaggerConfig.description,
        contact: {
          name: 'Fashon API Team',
          email: 'api@fashon.com',
          url: 'https://fashon.com/contact'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: this.options.swaggerConfig.servers,
      paths: this.generatePaths(),
      components: {
        schemas: this.generateSchemas(),
        securitySchemes: this.generateSecuritySchemes(),
        examples: this.generateExamples(),
        responses: this.generateCommonResponses()
      },
      tags: this.generateTags(),
      security: this.generateGlobalSecurity()
    };
    
    return spec;
  }

  generatePaths() {
    const paths = {};
    
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.hidden) continue;
      
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }
      
      const pathItem = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        parameters: endpoint.parameters,
        requestBody: endpoint.requestBody,
        responses: endpoint.responses,
        security: endpoint.security,
        deprecated: endpoint.deprecated
      };
      
      // Add examples if available
      if (endpoint.examples.length > 0) {
        pathItem['x-examples'] = endpoint.examples;
      }
      
      paths[endpoint.path][endpoint.method.toLowerCase()] = pathItem;
    }
    
    return paths;
  }

  generateSchemas() {
    const schemas = {};
    
    for (const schema of this.schemas.values()) {
      schemas[schema.name] = {
        type: schema.type,
        properties: schema.properties,
        required: schema.required,
        description: schema.description
      };
      
      if (schema.example) {
        schemas[schema.name].example = schema.example;
      }
    }
    
    return schemas;
  }

  generateSecuritySchemes() {
    return {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication token'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication'
      },
      basicAuth: {
        type: 'http',
        scheme: 'basic',
        description: 'Basic authentication'
      }
    };
  }

  generateExamples() {
    const examples = {};
    
    // Common examples
    examples.userExample = {
      summary: 'User example',
      value: {
        id: '123',
        email: 'user@example.com',
        name: 'John Doe',
        role: 'customer',
        createdAt: '2023-01-01T00:00:00.000Z'
      }
    };
    
    examples.productExample = {
      summary: 'Product example',
      value: {
        id: 'prod_123',
        name: 'Classic T-Shirt',
        description: 'Comfortable cotton t-shirt',
        price: 29.99,
        category: 'clothing',
        inStock: true,
        images: ['https://example.com/image1.jpg']
      }
    };
    
    examples.orderExample = {
      summary: 'Order example',
      value: {
        id: 'order_123',
        userId: '123',
        items: [
          {
            productId: 'prod_123',
            quantity: 2,
            price: 29.99
          }
        ],
        total: 59.98,
        status: 'pending',
        createdAt: '2023-01-01T00:00:00.000Z'
      }
    };
    
    return examples;
  }

  generateCommonResponses() {
    return {
      BadRequest: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' }
              }
            }
          }
        }
      },
      Unauthorized: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      },
      Forbidden: {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
                message: { type: 'string' },
                stack: { type: 'string' }
              }
            }
          }
        }
      }
    };
  }

  generateTags() {
    const tags = [];
    
    for (const tagName of this.tags) {
      tags.push({
        name: tagName,
        description: this.getTagDescription(tagName)
      });
    }
    
    return tags;
  }

  getTagDescription(tagName) {
    const descriptions = {
      authentication: 'User authentication and authorization endpoints',
      users: 'User management and profile endpoints',
      products: 'Product catalog and inventory endpoints',
      orders: 'Order management and processing endpoints',
      cart: 'Shopping cart management endpoints',
      payments: 'Payment processing and transactions endpoints',
      categories: 'Product category management endpoints',
      reviews: 'Product reviews and ratings endpoints',
      notifications: 'Push notification and messaging endpoints',
      analytics: 'Analytics and reporting endpoints',
      admin: 'Administrative and management endpoints'
    };
    
    return descriptions[tagName] || `Endpoints related to ${tagName}`;
  }

  generateGlobalSecurity() {
    return [
      {
        bearerAuth: []
      }
    ];
  }

  async generateReDocSpec() {
    const swaggerSpec = this.generateSwaggerSpec();
    
    const redocConfig = {
      spec: swaggerSpec,
      specUrl: '/api/docs/swagger.json',
      theme: {
        colors: {
          primary: {
            main: '#3f51b5'
          }
        }
      },
      hideHostname: true,
      expandResponses: '200',
      hideDownloadButton: false,
      nativeScrollbars: true,
      untrustedSpec: false
    };
    
    return redocConfig;
  }

  generatePostmanCollection() {
    const collection = {
      info: {
        name: 'Fashon API',
        description: 'Complete API collection for Fashon e-commerce platform',
        version: '1.0.0',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{jwt_token}}',
            type: 'string'
          }
        ]
      },
      variable: [
        {
          key: 'base_url',
          value: 'http://localhost:3000/api/v1',
            type: 'string'
        },
        {
          key: 'jwt_token',
          value: '',
          type: 'string'
        }
      ],
      item: this.generatePostmanFolders()
    };
    
    return collection;
  }

  generatePostmanFolders() {
    const folders = {};
    
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.hidden) continue;
      
      for (const tag of endpoint.tags) {
        if (!folders[tag]) {
          folders[tag] = {
            name: tag,
            description: this.getTagDescription(tag),
            item: []
          };
        }
        
        const request = {
          name: endpoint.summary,
          request: {
            method: endpoint.method,
            header: this.generatePostmanHeaders(endpoint),
            body: this.generatePostmanBody(endpoint),
            url: {
              raw: '{{base_url}}{{endpoint.path}}',
              host: ['{{base_url}}'],
              path: endpoint.path.split('/').filter(p => p)
            },
            description: endpoint.description
          },
          response: this.generatePostmanResponses(endpoint)
        };
        
        folders[tag].item.push(request);
      }
    }
    
    return Object.values(folders);
  }

  generatePostmanHeaders(endpoint) {
    const headers = [
      {
        key: 'Content-Type',
        value: 'application/json',
        type: 'text'
      },
      {
        key: 'Accept',
        value: 'application/json',
        type: 'text'
      }
    ];
    
    // Add security headers
    for (const security of endpoint.security) {
      if (security.bearerAuth) {
        headers.push({
          key: 'Authorization',
          value: 'Bearer {{jwt_token}}',
          type: 'text'
        });
      }
      if (security.apiKey) {
        headers.push({
          key: 'X-API-Key',
          value: '{{api_key}}',
          type: 'text'
        });
      }
    }
    
    return headers;
  }

  generatePostmanBody(endpoint) {
    if (!endpoint.requestBody) return null;
    
    return {
      mode: 'raw',
      raw: JSON.stringify(endpoint.requestBody.content['application/json'].example || {}, null, 2),
      options: {
        raw: {
          language: 'json'
        }
      }
    };
  }

  generatePostmanResponses(endpoint) {
    const responses = [];
    
    for (const [statusCode, response] of Object.entries(endpoint.responses)) {
      responses.push({
        name: `${statusCode} - response.description || 'Response'}`,
        originalRequest: {
          method: endpoint.method,
          header: [],
          url: {
            raw: '{{base_url}}{{endpoint.path}}',
            host: ['{{base_url}}'],
            path: endpoint.path.split('/').filter(p => p)
          }
        },
        status: statusCode,
        code: parseInt(statusCode),
        _postman_previewlanguage: 'json',
        header: response.headers || [],
        body: response.content?.['application/json']?.example || {}
      });
    }
    
    return responses;
  }

  generateMarkdownDocumentation() {
    let markdown = `# ${this.options.swaggerConfig.title}\n\n`;
    markdown += `${this.options.swaggerConfig.description}\n\n`;
    markdown += `## Version: ${this.options.swaggerConfig.version}\n\n`;
    
    // Table of Contents
    markdown += `## Table of Contents\n\n`;
    for (const tag of this.tags) {
      markdown += `- [${tag}](#${tag.toLowerCase().replace(/\s+/g, '-')})\n`;
    }
    markdown += `\n`;
    
    // Tags and endpoints
    for (const tag of this.tags) {
      markdown += `## ${tag}\n\n`;
      markdown += `${this.getTagDescription(tag)}\n\n`;
      
      const tagEndpoints = Array.from(this.endpoints.values())
        .filter(endpoint => endpoint.tags.includes(tag) && !endpoint.hidden);
      
      for (const endpoint of tagEndpoints) {
        markdown += `### ${endpoint.method.toUpperCase()} ${endpoint.path}\n\n`;
        markdown += `${endpoint.description}\n\n`;
        
        if (endpoint.parameters.length > 0) {
          markdown += `#### Parameters\n\n`;
          markdown += `| Name | Type | Required | Description |\n`;
          markdown += `|------|------|----------|-------------|\n`;
          
          for (const param of endpoint.parameters) {
            markdown += `| ${param.name} | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description} |\n`;
          }
          markdown += `\n`;
        }
        
        if (endpoint.requestBody) {
          markdown += `#### Request Body\n\n`;
          markdown += `\`\`\`json\n`;
          markdown += JSON.stringify(endpoint.requestBody.content?.['application/json']?.example || {}, null, 2);
          markdown += `\n\`\`\`\n\n`;
        }
        
        if (Object.keys(endpoint.responses).length > 0) {
          markdown += `#### Responses\n\n`;
          
          for (const [statusCode, response] of Object.entries(endpoint.responses)) {
            markdown += `**${statusCode}** - ${response.description}\n\n`;
            
            if (response.content?.['application/json']?.example) {
              markdown += `\`\`\`json\n`;
              markdown += JSON.stringify(response.content['application/json'].example, null, 2);
              markdown += `\n\`\`\`\n\n`;
            }
          }
        }
        
        markdown += `---\n\n`;
      }
    }
    
    return markdown;
  }

  async generateDocumentation() {
    const results = {
      swagger: null,
      redoc: null,
      postman: null,
      markdown: null
    };
    
    try {
      // Ensure output directory exists
      await fs.mkdir(this.options.outputPath, { recursive: true });
      
      // Generate Swagger
      if (this.options.enableSwagger) {
        const swaggerSpec = this.generateSwaggerSpec();
        const swaggerPath = path.join(this.options.outputPath, 'swagger.json');
        await fs.writeFile(swaggerPath, JSON.stringify(swaggerSpec, null, 2));
        results.swagger = swaggerPath;
        
        // Generate Swagger UI HTML
        const swaggerUIPath = path.join(this.options.outputPath, 'swagger.html');
        const swaggerUIHTML = this.generateSwaggerUIHTML();
        await fs.writeFile(swaggerUIPath, swaggerUIHTML);
      }
      
      // Generate ReDoc
      if (this.options.enableReDoc) {
        const redocConfig = await this.generateReDocSpec();
        const redocPath = path.join(this.options.outputPath, 'redoc.html');
        const redocHTML = this.generateReDocHTML(redocConfig);
        await fs.writeFile(redocPath, redocHTML);
        results.redoc = redocPath;
      }
      
      // Generate Postman Collection
      if (this.options.enablePostman) {
        const postmanCollection = this.generatePostmanCollection();
        const postmanPath = path.join(this.options.outputPath, 'postman_collection.json');
        await fs.writeFile(postmanPath, JSON.stringify(postmanCollection, null, 2));
        results.postman = postmanPath;
      }
      
      // Generate Markdown
      if (this.options.enableMarkdown) {
        const markdown = this.generateMarkdownDocumentation();
        const markdownPath = path.join(this.options.outputPath, 'README.md');
        await fs.writeFile(markdownPath, markdown);
        results.markdown = markdownPath;
      }
      
      this.metrics.documentationGenerated++;
      
      console.log('[API_DOCUMENTATION] Documentation generated successfully');
      this.emit('documentation:generated', results);
      
      return results;
      
    } catch (error) {
      console.error('[API_DOCUMENTATION] Failed to generate documentation:', error);
      throw error;
    }
  }

  generateSwaggerUIHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${this.options.swaggerConfig.title} - Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: './swagger.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>
    `;
  }

  generateReDocHTML(redocConfig) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${this.options.swaggerConfig.title} - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
        body { margin: 0; padding: 0; font-family: Roboto, sans-serif; }
    </style>
</head>
<body>
    <redoc spec-url='./swagger.json'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2.0.0/bundles/redoc.standalone.js"></script>
</body>
</html>
    `;
  }

  getStats() {
    return {
      ...this.metrics,
      endpoints: this.endpoints.size,
      schemas: this.schemas.size,
      tags: this.tags.size,
      documentationEnabled: {
        swagger: this.options.enableSwagger,
        redoc: this.options.enableReDoc,
        postman: this.options.enablePostman,
        markdown: this.options.enableMarkdown
      }
    };
  }

  middleware() {
    return (req, res, next) => {
      req.apiDocumentation = this;
      this.metrics.requestsToDocs++;
      next();
    };
  }

  // Static method to create API documentation
  static create(options = {}) {
    return new APIDocumentation(options);
  }
}

module.exports = APIDocumentation;
