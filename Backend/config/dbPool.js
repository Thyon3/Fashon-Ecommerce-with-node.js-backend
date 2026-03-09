const mongoose = require('mongoose');

class DatabasePool {
  static async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI;
      
      const options = {
        // Connection pool settings
        maxPoolSize: 10, // Maximum number of connections in the pool
        minPoolSize: 2,  // Minimum number of connections in the pool
        maxIdleTimeMS: 30000, // How long a connection can be idle before being closed
        
        // Connection settings
        serverSelectionTimeoutMS: 5000, // How long to try selecting a server
        socketTimeoutMS: 45000, // How long a send or receive on a socket can take
        connectTimeoutMS: 10000, // How long it takes to connect to a server
        
        // Retry settings
        retryWrites: true,
        retryReads: true,
        
        // Buffer settings
        bufferMaxEntries: 0, // Disable mongoose buffering
        bufferCommands: false, // Disable mongoose buffering
        
        // Other settings
        useNewUrlParser: true,
        useUnifiedTopology: true
      };
      
      // Connect to MongoDB
      await mongoose.connect(mongoUri, options);
      
      console.log('Connected to MongoDB with connection pool');
      
      // Handle connection events
      mongoose.connection.on('connected', () => {
        console.log('MongoDB connected');
      });
      
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
      });
      
      // Handle process termination
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      });
      
      return mongoose.connection;
      
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }
  
  static async getConnectionStats() {
    try {
      const stats = await mongoose.connection.db.stats();
      const admin = mongoose.connection.db.admin();
      const serverStatus = await admin.serverStatus();
      
      return {
        database: stats,
        connections: serverStatus.connections,
        pool: {
          activeConnections: mongoose.connection.readyState === 1,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name
        }
      };
    } catch (error) {
      console.error('Error getting connection stats:', error);
      return null;
    }
  }
}

module.exports = DatabasePool;
