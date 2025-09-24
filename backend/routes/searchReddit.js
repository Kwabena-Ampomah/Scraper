/**
 * Reddit Search API Endpoints
 * 
 * REST API endpoints for triggering Reddit searches
 */

const express = require('express');
const router = express.Router();
const PipelineOrchestrator = require('../services/pipeline/pipelineOrchestrator');
const { searchConfigurations } = require('../config/searchConfigurations');
const logger = require('../utils/logger');

// Global orchestrator instance
let orchestrator = null;

// Initialize orchestrator
const initOrchestrator = async () => {
  if (!orchestrator) {
    orchestrator = new PipelineOrchestrator();
    await orchestrator.initialize();
  }
  return orchestrator;
};

/**
 * GET /api/search/configurations
 * Get available search configurations
 */
router.get('/configurations', async (req, res) => {
  try {
    res.json({
      success: true,
      configurations: searchConfigurations
    });
  } catch (error) {
    logger.error('Error getting configurations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/search/run
 * Run a custom Reddit search
 */
router.post('/run', async (req, res) => {
  try {
    const { subreddit, searchTerms, limit = 10, timeframe = 'day' } = req.body;

    if (!subreddit || !searchTerms || !Array.isArray(searchTerms)) {
      return res.status(400).json({
        success: false,
        error: 'subreddit and searchTerms (array) are required'
      });
    }

    const orchestrator = await initOrchestrator();

    const searchConfig = {
      subreddit,
      searchTerms,
      limit: Math.min(limit, 100), // Cap at 100 posts
      timeframe
    };

    logger.info('Running custom Reddit search:', searchConfig);

    const result = await orchestrator.runCustomPipeline(searchConfig);

    res.json({
      success: result.success,
      result: {
        scraped: result.scraped,
        processed: result.processed,
        embedded: result.embedded,
        indexed: result.indexed
      },
      config: searchConfig
    });

  } catch (error) {
    logger.error('Error running search:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/search/run/:configName
 * Run a predefined search configuration
 */
router.post('/run/:configName', async (req, res) => {
  try {
    const { configName } = req.params;
    const config = searchConfigurations[configName];

    if (!config) {
      return res.status(404).json({
        success: false,
        error: `Configuration '${configName}' not found`
      });
    }

    const orchestrator = await initOrchestrator();

    logger.info(`Running predefined search: ${configName}`, config);

    const result = await orchestrator.runCustomPipeline(config);

    res.json({
      success: result.success,
      result: {
        scraped: result.scraped,
        processed: result.processed,
        embedded: result.embedded,
        indexed: result.indexed
      },
      config: config
    });

  } catch (error) {
    logger.error('Error running predefined search:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/search/stats
 * Get pipeline statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const orchestrator = await initOrchestrator();
    const stats = orchestrator.getStats();

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/search/schedule
 * Schedule a recurring search
 */
router.post('/schedule', async (req, res) => {
  try {
    const { configName, cronExpression } = req.body;

    if (!configName || !cronExpression) {
      return res.status(400).json({
        success: false,
        error: 'configName and cronExpression are required'
      });
    }

    const config = searchConfigurations[configName];
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `Configuration '${configName}' not found`
      });
    }

    const orchestrator = await initOrchestrator();
    const job = orchestrator.schedulePipeline(configName, config, cronExpression);

    res.json({
      success: true,
      message: `Scheduled ${configName} with cron: ${cronExpression}`,
      jobName: configName,
      cronExpression: cronExpression
    });

  } catch (error) {
    logger.error('Error scheduling search:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
