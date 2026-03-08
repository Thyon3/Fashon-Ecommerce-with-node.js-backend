const OrderModel = require("../models/order");
const notificationService = require("../heplers/notificationService");

// Track order status and location
exports.trackOrder = async function (req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Find order and verify ownership
    const order = await OrderModel.findOne({ 
      _id: orderId, 
      user: userId 
    })
    .populate('orderItem')
    .populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    // Format tracking information
    const trackingInfo = {
      orderId: order._id,
      status: order.status,
      trackingNumber: order.trackingNumber,
      estimatedDelivery: order.estimatedDelivery,
      statusHistory: order.statusHistory || [],
      currentLocation: order.currentLocation || 'Processing Center',
      shippingAddress: {
        street: order.shippingAddress,
        city: order.city,
        postalCode: order.postalCode,
        country: order.country
      },
      orderDate: order.dateOrdered,
      totalAmount: order.totalPrice,
      items: order.orderItem.map(item => ({
        name: item.productName || 'Product',
        quantity: item.quantity,
        price: item.price
      }))
    };

    res.status(200).json({
      tracking: trackingInfo
    });

  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Update order tracking information
exports.updateTracking = async function (req, res) {
  try {
    const { orderId } = req.params;
    const { status, location, estimatedDelivery, notes } = req.body;

    // Find order
    const order = await OrderModel.findById(orderId);
    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    // Update tracking information
    if (status) {
      order.status = status;
    }

    if (location) {
      order.currentLocation = location;
    }

    if (estimatedDelivery) {
      order.estimatedDelivery = new Date(estimatedDelivery);
    }

    // Add to status history
    const statusUpdate = {
      status: status || order.status,
      timestamp: new Date(),
      location: location || order.currentLocation,
      notes: notes || `Status updated to ${status || order.status}`
    };

    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    order.statusHistory.push(statusUpdate);

    await order.save();

    // Send notification to user
    if (status) {
      await notificationService.createNotification(
        order.user,
        'order_status_update',
        `Order Status Updated`,
        `Your order #${orderId.slice(-8).toUpperCase()} status has been updated to ${status}`,
        {
          orderId,
          status,
          location,
          estimatedDelivery
        }
      );
    }

    res.status(200).json({
      message: "Tracking information updated successfully",
      order: order
    });

  } catch (error) {
    console.error('Update tracking error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get all tracking updates for an order
exports.getTrackingHistory = async function (req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Find order and verify ownership
    const order = await OrderModel.findOne({ 
      _id: orderId, 
      user: userId 
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    const trackingHistory = order.statusHistory || [];
    
    // Format tracking events
    const events = trackingHistory.map(event => ({
      status: event.status,
      timestamp: event.timestamp,
      location: event.location,
      description: event.notes || `Order ${event.status}`,
      type: this.getEventType(event.status)
    }));

    res.status(200).json({
      orderId: order._id,
      events: events,
      currentStatus: order.status,
      trackingNumber: order.trackingNumber
    });

  } catch (error) {
    console.error('Get tracking history error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Get estimated delivery date
exports.getEstimatedDelivery = async function (req, res) {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Find order and verify ownership
    const order = await OrderModel.findOne({ 
      _id: orderId, 
      user: userId 
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    // Calculate estimated delivery based on status
    let estimatedDelivery = order.estimatedDelivery;
    
    if (!estimatedDelivery) {
      estimatedDelivery = this.calculateEstimatedDelivery(order);
    }

    res.status(200).json({
      orderId: order._id,
      estimatedDelivery,
      currentStatus: order.status,
      deliveryDaysRemaining: this.getDaysRemaining(estimatedDelivery)
    });

  } catch (error) {
    console.error('Get estimated delivery error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Helper function to get event type based on status
function getEventType(status) {
  const eventTypes = {
    'pending': 'order_placed',
    'processed': 'order_processed',
    'shipped': 'order_shipped',
    'out-of-delivery': 'out_for_delivery',
    'delivered': 'order_delivered',
    'cancelled': 'order_cancelled',
    'on-hold': 'order_on_hold'
  };
  
  return eventTypes[status] || 'order_update';
}

// Helper function to calculate estimated delivery
function calculateEstimatedDelivery(order) {
  const now = new Date();
  const orderDate = new Date(order.dateOrdered);
  
  // Default delivery times based on status
  const deliveryTimes = {
    'pending': 5, // 5 days from order date
    'processed': 4, // 4 days from now
    'shipped': 3, // 3 days from now
    'out-of-delivery': 1, // 1 day from now
    'delivered': 0, // Already delivered
    'cancelled': null // No delivery
  };
  
  const days = deliveryTimes[order.status] || 5;
  
  if (days === null) {
    return null;
  }
  
  const estimatedDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
  return estimatedDate;
}

// Helper function to get days remaining
function getDaysRemaining(estimatedDate) {
  if (!estimatedDate) return null;
  
  const now = new Date();
  const diffTime = estimatedDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

// Get tracking statistics
exports.getTrackingStats = async function (req, res) {
  try {
    const userId = req.user.id;

    // Get all user orders
    const orders = await OrderModel.find({ user: userId });

    // Calculate statistics
    const stats = {
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      shippedOrders: orders.filter(o => o.status === 'shipped').length,
      deliveredOrders: orders.filter(o => o.status === 'delivered').length,
      averageDeliveryTime: this.calculateAverageDeliveryTime(orders),
      onTimeDeliveryRate: this.calculateOnTimeDeliveryRate(orders)
    };

    res.status(200).json(stats);

  } catch (error) {
    console.error('Get tracking stats error:', error);
    res.status(500).json({
      type: error.name,
      message: error.message
    });
  }
};

// Helper function to calculate average delivery time
function calculateAverageDeliveryTime(orders) {
  const deliveredOrders = orders.filter(o => 
    o.status === 'delivered' && 
    o.dateOrdered && 
    o.statusHistory && 
    o.statusHistory.length > 0
  );

  if (deliveredOrders.length === 0) return 0;

  const deliveryTimes = deliveredOrders.map(order => {
    const orderDate = new Date(order.dateOrdered);
    const deliveredEvent = order.statusHistory.find(event => event.status === 'delivered');
    
    if (!deliveredEvent) return 0;
    
    const deliveredDate = new Date(deliveredEvent.timestamp);
    const diffTime = deliveredDate - orderDate;
    return diffTime / (1000 * 60 * 60 * 24); // Convert to days
  });

  const averageTime = deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length;
  return Math.round(averageTime * 10) / 10; // Round to 1 decimal place
}

// Helper function to calculate on-time delivery rate
function calculateOnTimeDeliveryRate(orders) {
  const deliveredOrders = orders.filter(o => 
    o.status === 'delivered' && 
    o.estimatedDelivery
  );

  if (deliveredOrders.length === 0) return 100; // No delivered orders yet

  const onTimeDeliveries = deliveredOrders.filter(order => {
    const deliveredEvent = order.statusHistory.find(event => event.status === 'delivered');
    if (!deliveredEvent) return false;
    
    const deliveredDate = new Date(deliveredEvent.timestamp);
    const estimatedDate = new Date(order.estimatedDelivery);
    
    return deliveredDate <= estimatedDate;
  });

  const rate = (onTimeDeliveries.length / deliveredOrders.length) * 100;
  return Math.round(rate * 10) / 10; // Round to 1 decimal place
}
