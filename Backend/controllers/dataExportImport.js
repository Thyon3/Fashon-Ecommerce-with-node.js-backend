const ProductModel = require("../models/product");
const UserModel = require("../models/user");
const OrderModel = require("../models/order");
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class DataExportImport {
  // Export products to CSV
  static async exportProductsToCSV(filter = {}) {
    try {
      const products = await ProductModel.find(filter)
        .populate('category', 'name')
        .sort({ name: 1 });

      const csvData = products.map(product => ({
        id: product._id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        category: product.category ? product.category.name : '',
        colors: (product.Colors || []).join(';'),
        sizes: (product.sizes || []).join(';'),
        stock: product.numberInStock || 0,
        rating: product.rating || 0,
        isAvailable: product.isAvailable || false,
        isFeatured: product.isFeatured || false,
        createdAt: product.createdAt ? product.createdAt.toISOString() : '',
        updatedAt: product.updatedAt ? product.updatedAt.toISOString() : ''
      }));

      const csvHeader = 'ID,Name,Description,Price,Category,Colors,Sizes,Stock,Rating,Available,Featured,Created At,Updated At\n';
      const csvContent = csvHeader + csvData.map(row => 
        `${row.id},"${row.name}","${row.description}","${row.price}","${row.category}","${row.colors}","${row.sizes}",${row.stock},${row.rating},${row.isAvailable},${row.isFeatured},"${row.createdAt}","${row.updatedAt}"`
      ).join('\n');

      return {
        success: true,
        data: csvContent,
        filename: `products_export_${new Date().toISOString().split('T')[0]}.csv`,
        count: products.length
      };

    } catch (error) {
      console.error('Export products error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Export users to CSV
  static async exportUsersToCSV(filter = {}) {
    try {
      const users = await UserModel.find(filter)
        .select('-passwordHash -resetPasswordOtp -resetPasswordOtpExpires')
        .sort({ createdAt: -1 });

      const csvData = users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        isAdmin: user.isAdmin || false,
        isActive: user.isActive !== false,
        lastLogin: user.lastLogin ? user.lastLogin.toISOString() : '',
        createdAt: user.createdAt ? user.createdAt.toISOString() : '',
        address: user.street ? `${user.street}, ${user.city}, ${user.postalCode}, ${user.country}` : ''
      }));

      const csvHeader = 'ID,Name,Email,Phone,Is Admin,Is Active,Last Login,Created At,Address\n';
      const csvContent = csvHeader + csvData.map(row => 
        `${row.id},"${row.name}","${row.email}","${row.phone}",${row.isAdmin},${row.isActive},"${row.lastLogin}","${row.createdAt}","${row.address}"`
      ).join('\n');

      return {
        success: true,
        data: csvContent,
        filename: `users_export_${new Date().toISOString().split('T')[0]}.csv`,
        count: users.length
      };

    } catch (error) {
      console.error('Export users error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Export orders to CSV
  static async exportOrdersToCSV(filter = {}) {
    try {
      const orders = await OrderModel.find(filter)
        .populate('user', 'name email')
        .sort({ dateOrdered: -1 });

      const csvData = orders.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber || '',
        customerName: order.user ? order.user.name : '',
        customerEmail: order.user ? order.user.email : '',
        totalPrice: order.totalPrice || 0,
        status: order.status || '',
        paymentMethod: order.paymentMethod || '',
        dateOrdered: order.dateOrdered ? order.dateOrdered.toISOString() : '',
        trackingNumber: order.trackingNumber || '',
        itemCount: order.orderItem ? order.orderItem.length : 0,
        shippingAddress: order.shippingAddress || ''
      }));

      const csvHeader = 'ID,Order Number,Customer Name,Customer Email,Total Price,Status,Payment Method,Order Date,Tracking Number,Item Count,Shipping Address\n';
      const csvContent = csvHeader + csvData.map(row => 
        `${row.id},"${row.orderNumber}","${row.customerName}","${row.customerEmail}","${row.totalPrice}","${row.status}","${row.paymentMethod}","${row.dateOrdered}","${row.trackingNumber}",${row.itemCount},"${row.shippingAddress}"`
      ).join('\n');

      return {
        success: true,
        data: csvContent,
        filename: `orders_export_${new Date().toISOString().split('T')[0]}.csv`,
        count: orders.length
      };

    } catch (error) {
      console.error('Export orders error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Import products from CSV
  static async importProductsFromCSV(filePath) {
    try {
      const results = {
        success: true,
        imported: 0,
        updated: 0,
        errors: [],
        skipped: 0
      };

      return new Promise((resolve, reject) => {
        const products = [];
        
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            try {
              const productData = {
                name: data.Name || '',
                description: data.Description || '',
                price: parseFloat(data.Price) || 0,
                category: data.Category || '',
                colors: data.Colors ? data.Colors.split(';').filter(c => c.trim()) : [],
                sizes: data.Sizes ? data.Sizes.split(';').filter(s => s.trim()) : [],
                numberInStock: parseInt(data.Stock) || 0,
                isAvailable: data.Available === 'true',
                isFeatured: data.Featured === 'true'
              };

              products.push(productData);
            } catch (error) {
              results.errors.push({
                row: products.length + 1,
                error: error.message,
                data
              });
            }
          })
          .on('end', async () => {
            try {
              for (const productData of products) {
                try {
                  // Check if product exists
                  const existingProduct = await ProductModel.findOne({ name: productData.name });
                  
                  if (existingProduct) {
                    // Update existing product
                    await ProductModel.findByIdAndUpdate(existingProduct._id, {
                      ...productData,
                      updatedAt: new Date()
                    });
                    results.updated++;
                  } else {
                    // Create new product
                    await ProductModel.create({
                      ...productData,
                      createdAt: new Date(),
                      updatedAt: new Date()
                    });
                    results.imported++;
                  }
                } catch (error) {
                  results.errors.push({
                    error: error.message,
                    data: productData
                  });
                }
              }

              resolve(results);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (error) => {
            reject(error);
          });
      });

    } catch (error) {
      console.error('Import products error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Import users from CSV
  static async importUsersFromCSV(filePath) {
    try {
      const results = {
        success: true,
        imported: 0,
        updated: 0,
        errors: [],
        skipped: 0
      };

      return new Promise((resolve, reject) => {
        const users = [];
        
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            try {
              const userData = {
                name: data.Name || '',
                email: data.Email || '',
                phone: data.Phone || '',
                isAdmin: data['Is Admin'] === 'true',
                street: data.Address || '',
                city: data.City || '',
                postalCode: data['Postal Code'] || '',
                country: data.Country || ''
              };

              users.push(userData);
            } catch (error) {
              results.errors.push({
                row: users.length + 1,
                error: error.message,
                data
              });
            }
          })
          .on('end', async () => {
            try {
              for (const userData of users) {
                try {
                  // Check if user exists
                  const existingUser = await UserModel.findOne({ email: userData.email });
                  
                  if (existingUser) {
                    results.skipped++;
                    continue; // Skip existing users
                  } else {
                    // Create new user
                    await UserModel.create({
                      ...userData,
                      isActive: true,
                      createdAt: new Date(),
                      updatedAt: new Date()
                    });
                    results.imported++;
                  }
                } catch (error) {
                  results.errors.push({
                    error: error.message,
                    data: userData
                  });
                }
              }

              resolve(results);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (error) => {
            reject(error);
          });
      });

    } catch (error) {
      console.error('Import users error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Export data to JSON
  static async exportToJSON(modelType, filter = {}) {
    try {
      let data;
      let filename;
      
      switch (modelType) {
        case 'products':
          data = await ProductModel.find(filter).populate('category', 'name');
          filename = `products_export_${new Date().toISOString().split('T')[0]}.json`;
          break;
        case 'users':
          data = await UserModel.find(filter).select('-passwordHash -resetPasswordOtp -resetPasswordOtpExpires');
          filename = `users_export_${new Date().toISOString().split('T')[0]}.json`;
          break;
        case 'orders':
          data = await OrderModel.find(filter).populate('user', 'name email');
          filename = `orders_export_${new Date().toISOString().split('T')[0]}.json`;
          break;
        default:
          throw new Error('Invalid model type. Use: products, users, or orders');
      }

      return {
        success: true,
        data: JSON.stringify(data, null, 2),
        filename,
        count: Array.isArray(data) ? data.length : 0
      };

    } catch (error) {
      console.error('Export JSON error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get export/import statistics
  static async getExportImportStats() {
    try {
      const productCount = await ProductModel.countDocuments();
      const userCount = await UserModel.countDocuments();
      const orderCount = await OrderModel.countDocuments();
      
      return {
        products: {
          total: productCount,
          available: await ProductModel.countDocuments({ isAvailable: true }),
          featured: await ProductModel.countDocuments({ isFeatured: true }),
          lowStock: await ProductModel.countDocuments({ numberInStock: { $gt: 0, $lte: 10 } })
        },
        users: {
          total: userCount,
          active: await UserModel.countDocuments({ isActive: true }),
          admins: await UserModel.countDocuments({ isAdmin: true })
        },
        orders: {
          total: orderCount,
          pending: await OrderModel.countDocuments({ status: 'pending' }),
          shipped: await OrderModel.countDocuments({ status: 'shipped' }),
          delivered: await OrderModel.countDocuments({ status: 'delivered' })
        }
      };

    } catch (error) {
      console.error('Stats error:', error);
      throw error;
    }
  }

  // Validate CSV file
  static validateCSVFile(filePath, requiredColumns = []) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split('\n');
      
      if (lines.length < 2) {
        return { valid: false, error: 'File is empty or has no data rows' };
      }

      const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
      const missingColumns = requiredColumns.filter(col => !header.includes(col));
      
      if (missingColumns.length > 0) {
        return { 
          valid: false, 
          error: `Missing required columns: ${missingColumns.join(', ')}` 
        };
      }

      return { valid: true, totalRows: lines.length - 1 };

    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = DataExportImport;
