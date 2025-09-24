#!/usr/bin/env node

/**
 * One-Time Reddit Search
 * 
 * Run a single Reddit search with custom parameters
 */

require('dotenv').config();
const PipelineOrchestrator = require('../services/pipeline/pipelineOrchestrator');
const winston = require('winston');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

async function runRedditSearch() {
  logger.info('🔍 Starting One-Time Reddit Search...');

  const orchestrator = new PipelineOrchestrator();

  try {
    // Initialize pipeline
    await orchestrator.initialize();
    logger.info('✅ Pipeline initialized');

    // Define search parameters
    const searchConfig = {
      subreddit: 'whoop',
      searchTerms: ['WHOOP 5.0', 'new WHOOP', 'WHOOP band'],
      limit: 25, // Number of posts to scrape
      timeframe: 'week' // Time range: hour, day, week, month, year, all
    };

    logger.info('🔍 Search Configuration:', searchConfig);

    // Run the search
    const result = await orchestrator.runCustomPipeline(searchConfig);

    if (result.success) {
      logger.info('✅ Search completed successfully!', {
        scraped: result.scraped,
        processed: result.processed,
        embedded: result.embedded,
        indexed: result.indexed
      });

      // Get pipeline stats
      const stats = orchestrator.getStats();
      logger.info('📊 Pipeline Statistics:', stats);

    } else {
      logger.error('❌ Search failed:', result);
    }

  } catch (error) {
    logger.error('❌ Search error:', error.message);
  } finally {
    await orchestrator.cleanup();
    logger.info('🧹 Cleanup completed');
  }
}

// Run the search
if (require.main === module) {
  runRedditSearch().catch(error => {
    logger.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { runRedditSearch };
