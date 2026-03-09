const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/user');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.rooms = new Map();
    this.port = process.env.WS_PORT || 8080;
  }

  // Initialize WebSocket server
  initialize() {
    this.wss = new WebSocket.Server({ 
      port: this.port,
      perMessageDeflate: false
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    // Heartbeat to keep connections alive
    setInterval(() => {
      this.broadcastHeartbeat();
    }, 30000); // 30 seconds

    console.log(`WebSocket server running on port ${this.port}`);
  }

  // Handle new WebSocket connection
  async handleConnection(ws, req) {
    const clientId = this.generateClientId();
    
    try {
      // Authenticate client using JWT token from query params
      const token = this.extractTokenFromRequest(req);
      let user = null;
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRETSTRING);
          user = await UserModel.findById(decoded.id);
          
          if (!user) {
            ws.close(1008, 'Invalid user');
            return;
          }
        } catch (error) {
          ws.close(1008, 'Invalid token');
          return;
        }
      }

      // Store client connection
      const client = {
        id: clientId,
        ws,
        user,
        rooms: new Set(),
        lastActivity: new Date(),
        isAuthenticated: !!user,
        userAgent: req.headers['user-agent'],
        ip: req.connection.remoteAddress
      };

      this.clients.set(clientId, client);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        data: {
          clientId,
          message: user ? `Connected as ${user.name}` : 'Connected anonymously',
          timestamp: new Date().toISOString()
        }
      });

      // Setup message handlers
      this.setupMessageHandlers(client);

      console.log(`Client connected: ${clientId} (Authenticated: ${!!user})`);

    } catch (error) {
      console.error('Connection error:', error);
      ws.close(1011, 'Connection error');
    }
  }

  // Setup message handlers for client
  setupMessageHandlers(client) {
    client.ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        this.handleMessage(client, data);
      } catch (error) {
        console.error('Message parsing error:', error);
        this.sendToClient(client.id, {
          type: 'error',
          data: { message: 'Invalid message format' }
        });
      }
    });

    client.ws.on('close', () => {
      this.handleDisconnection(client);
    });

    client.ws.on('error', (error) => {
      console.error(`Client error (${client.id}):`, error);
    });
  }

  // Handle incoming messages
  handleMessage(client, data) {
    client.lastActivity = new Date();

    switch (data.type) {
      case 'join_room':
        this.joinRoom(client.id, data.room);
        break;
      case 'leave_room':
        this.leaveRoom(client.id, data.room);
        break;
      case 'private_message':
        this.sendPrivateMessage(client, data);
        break;
      case 'ping':
        this.sendToClient(client.id, { type: 'pong', timestamp: new Date().toISOString() });
        break;
      default:
        console.log(`Unknown message type: ${data.type}`);
    }
  }

  // Handle client disconnection
  handleDisconnection(client) {
    // Leave all rooms
    client.rooms.forEach(room => {
      this.leaveRoom(client.id, room);
    });

    // Remove client
    this.clients.delete(client.id);
    console.log(`Client disconnected: ${client.id}`);
  }

  // Join a room
  joinRoom(clientId, room) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }

    this.rooms.get(room).add(clientId);
    client.rooms.add(room);

    // Notify room members
    this.broadcastToRoom(room, {
      type: 'user_joined',
      data: {
        user: client.user ? client.user.name : 'Anonymous',
        clientId: client.id,
        room,
        timestamp: new Date().toISOString()
      }
    }, clientId);

    this.sendToClient(clientId, {
      type: 'room_joined',
      data: { room, members: this.getRoomMembers(room) }
    });
  }

  // Leave a room
  leaveRoom(clientId, room) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(clientId);
      client.rooms.delete(room);

      // Notify remaining room members
      this.broadcastToRoom(room, {
        type: 'user_left',
        data: {
          user: client.user ? client.user.name : 'Anonymous',
          clientId: client.id,
          room,
          timestamp: new Date().toISOString()
        }
      });

      // Clean up empty rooms
      if (this.rooms.get(room).size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  // Send private message
  sendPrivateMessage(senderClient, data) {
    if (!senderClient.isAuthenticated) {
      this.sendToClient(senderClient.id, {
        type: 'error',
        data: { message: 'Authentication required to send messages' }
      });
      return;
    }

    const recipientId = data.recipientId;
    const recipientClient = this.clients.get(recipientId);

    if (!recipientClient) {
      this.sendToClient(senderClient.id, {
        type: 'error',
        data: { message: 'Recipient not found' }
      });
      return;
    }

    const message = {
      type: 'private_message',
      data: {
        from: senderClient.user ? senderClient.user.name : 'Anonymous',
        fromId: senderClient.id,
        message: data.message,
        timestamp: new Date().toISOString()
      }
    };

    this.sendToClient(recipientId, message);
    this.sendToClient(senderClient.id, {
      type: 'message_sent',
      data: { recipientId, message: data.message }
    });
  }

  // Broadcast to all clients
  broadcast(message, excludeClientId = null) {
    const messageData = JSON.stringify(message);
    
    this.clients.forEach((clientId, client) => {
      if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageData);
      }
    });
  }

  // Broadcast to specific room
  broadcastToRoom(room, message, excludeClientId = null) {
    if (!this.rooms.has(room)) return;

    const messageData = JSON.stringify({
      ...message,
      room
    });

    this.rooms.get(room).forEach(clientId => {
      if (clientId !== excludeClientId) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageData);
        }
      }
    });
  }

  // Send message to specific client
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  // Send notification to specific user
  sendNotificationToUser(userId, notification) {
    this.clients.forEach((clientId, client) => {
      if (client.user && client.user._id.toString() === userId.toString()) {
        this.sendToClient(clientId, {
          type: 'notification',
          data: notification
        });
      }
    });
  }

  // Send order status update
  sendOrderStatusUpdate(userId, orderData) {
    this.sendNotificationToUser(userId, {
      type: 'order_status',
      data: orderData
    });
  }

  // Send new message notification
  sendNewMessageNotification(userId, messageData) {
    this.sendNotificationToUser(userId, {
      type: 'new_message',
      data: messageData
    });
  }

  // Broadcast heartbeat
  broadcastHeartbeat() {
    this.broadcast({
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    });
  }

  // Get room members
  getRoomMembers(room) {
    if (!this.rooms.has(room)) return [];

    return Array.from(this.rooms.get(room)).map(clientId => {
      const client = this.clients.get(clientId);
      return {
        clientId,
        user: client.user ? client.user.name : 'Anonymous',
        isAuthenticated: client.isAuthenticated
      };
    });
  }

  // Get client statistics
  getStats() {
    const totalClients = this.clients.size;
    const authenticatedClients = Array.from(this.clients.values()).filter(c => c.isAuthenticated).length;
    const totalRooms = this.rooms.size;

    return {
      totalClients,
      authenticatedClients,
      anonymousClients: totalClients - authenticatedClients,
      totalRooms,
      uptime: process.uptime(),
      port: this.port
    };
  }

  // Extract JWT token from request
  extractTokenFromRequest(req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('token');
  }

  // Generate unique client ID
  generateClientId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Clean up inactive connections
  cleanupInactiveConnections() {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    this.clients.forEach((clientId, client) => {
      if (now - client.lastActivity > inactiveThreshold) {
        client.ws.close(1000, 'Inactive connection');
      }
    });
  }

  // Shutdown WebSocket server
  shutdown() {
    if (this.wss) {
      this.wss.close(() => {
        console.log('WebSocket server closed');
      });
    }
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

module.exports = webSocketService;
