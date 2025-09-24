const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Check Supabase connection if configured
    let databaseStatus = { status: 'not_configured' };
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        
        // Simple health check query
        const { data, error } = await supabase
          .from('embeddings')
          .select('id')
          .limit(1);
          
        if (error && error.code !== 'PGRST116') { // PGRST116 = relation does not exist (which is ok)
          throw error;
        }
        
        databaseStatus = {
          status: 'healthy',
          responseTime: Date.now() - startTime,
          currentTime: new Date().toISOString()
        };
      } catch (error) {
        logger.warn('Database health check failed:', error.message);
        databaseStatus = {
          status: 'error',
          error: error.message,
          responseTime: Date.now() - startTime
        };
      }
    }
    
    // Check external services
    const services = {
      database: databaseStatus,
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

    // Overall health status
    const isHealthy = databaseStatus.status !== 'error';
    
    const response = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services
    };

    logger.info(`Health check: ${response.status}`);
    
    // Return 200 even if some services are not configured (but not if database fails)
    res.status(200).json(response);
    
  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      version: process.env.npm_package_version || '1.0.0'
    });
  }
});

/**
 * Simple ping endpoint
 * GET /api/health/ping
 */
router.get('/ping', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'pong'
  });
});

module.exports = router;
