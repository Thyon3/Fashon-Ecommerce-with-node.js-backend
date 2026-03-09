const express = require('express');
const HealthCheck = require('../controllers/health');

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await HealthCheck.getHealthStatus();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness probe
router.get('/health/live', async (req, res) => {
  try {
    const liveness = await HealthCheck.getLiveness();
    res.status(200).json(liveness);
  } catch (error) {
    res.status(503).json({
      status: 'dead',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness probe
router.get('/health/ready', async (req, res) => {
  try {
    const readiness = await HealthCheck.getReadiness();
    const statusCode = readiness.status === 'ready' ? 200 : 503;
    res.status(statusCode).json(readiness);
  } catch (error) {
    res.status(503).json({
      status: 'not-ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
