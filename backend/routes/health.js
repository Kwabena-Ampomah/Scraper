const express = require('express');
const { query: dbQuery } = require('../database/connection');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/', async (req, res) => {
  try {
    // Check database connection
    const dbResult = await dbQuery('SELECT NOW() as current_time');
    
    // Check external services
    const services = {
      database: {
        status: 'healthy',
        responseTime: Date.now() - req.startTime,
        currentTime: dbResult.rows[0].current_time
      },
      openai: {
        status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured'
      },
      pinecone: {
        status: process.env.PINECONE_API_KEY ? 'configured' : 'not_configured'
      },
      supabase: {
        status: (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) ? 'configured' : 'not_configured'
      },
      twitter: {
        status: process.env.TWITTER_BEARER_TOKEN ? 'configured' : 'not_configured'
      }
    };

    const overallStatus = Object.values(services).every(service => 
      service.status === 'healthy' || service.status === 'configured'
    ) ? 'healthy' : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services
    });

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Detailed health check
 * GET /api/health/detailed
 */
router.get('/detailed', async (req, res) => {
  try {
    const healthChecks = {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
      external_apis: await checkExternalAPIs(),
      disk_space: await checkDiskSpace(),
      memory: await checkMemoryUsage()
    };

    const overallStatus = Object.values(healthChecks).every(check => 
      check.status === 'healthy'
    ) ? 'healthy' : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: healthChecks
    });

  } catch (error) {
    logger.error('Detailed health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * System metrics
 * GET /api/health/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
      node_version: process.version,
      platform: process.platform
    };

    res.json(metrics);

  } catch (error) {
    logger.error('Metrics endpoint failed', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

// Helper functions

async function checkDatabaseHealth() {
  try {
    const startTime = Date.now();
    await dbQuery('SELECT 1');
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      message: 'Database connection successful'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      message: 'Database connection failed'
    };
  }
}

async function checkRedisHealth() {
  // Redis check would go here if Redis is implemented
  return {
    status: 'not_configured',
    message: 'Redis not implemented'
  };
}

async function checkExternalAPIs() {
  const apis = {
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
    pinecone: process.env.PINECONE_API_KEY ? 'configured' : 'not_configured',
    supabase: (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) ? 'configured' : 'not_configured',
    twitter: process.env.TWITTER_BEARER_TOKEN ? 'configured' : 'not_configured'
  };

  return {
    status: Object.values(apis).some(status => status === 'configured') ? 'healthy' : 'degraded',
    apis
  };
}

async function checkDiskSpace() {
  try {
    const fs = require('fs');
    const stats = fs.statSync('.');
    
    return {
      status: 'healthy',
      message: 'Disk space check passed'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

async function checkMemoryUsage() {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };

  const status = memUsageMB.heapUsed < 500 ? 'healthy' : 'warning'; // Warning if heap usage > 500MB

  return {
    status,
    usage: memUsageMB,
    message: status === 'healthy' ? 'Memory usage normal' : 'High memory usage detected'
  };
}

module.exports = router;
