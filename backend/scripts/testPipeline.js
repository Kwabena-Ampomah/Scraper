#!/usr/bin/env node

/**
 * Test Script for ETL Pipeline
 * 
 * Runs a small test to verify pipeline components work correctly
 */

require('dotenv').config();
const PipelineOrchestrator = require('../backend/services/pipeline/pipelineOrchestrator');
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

async function testPipeline() {
  logger.info('🧪 Starting ETL Pipeline Test...');

  const orchestrator = new PipelineOrchestrator();

  try {
    // Initialize pipeline
    logger.info('🔧 Initializing pipeline...');
    await orchestrator.initialize();
    logger.info('✅ Pipeline initialized successfully');

    // Test configuration (small dataset)
    const testConfig = {
      subreddit: 'whoop',
      searchTerms: ['WHOOP 5.0'],
      limit: 5, // Very small for testing
      timeframe: 'week'
    };

    logger.info('🔄 Running test pipeline...', { config: testConfig });
    
    const result = await orchestrator.runCustomPipeline(testConfig);
    
    if (result.success) {
      logger.info('✅ Test pipeline completed successfully!', { result });
      
      // Test similarity search
      logger.info('🔍 Testing similarity search...');
      const searchResults = await orchestrator.searchSimilar('WHOOP 5.0 sleep tracking', { limit: 3 });
      logger.info('✅ Similarity search completed', { results: searchResults.length });
      
      // Get stats
      const stats = orchestrator.getStats();
      logger.info('📊 Pipeline stats', { stats });
      
    } else {
      logger.error('❌ Test pipeline failed', { result });
    }

  } catch (error) {
    logger.error('❌ Test failed', { error: error.message });
  } finally {
    await orchestrator.cleanup();
    logger.info('🧹 Test cleanup completed');
  }
}

// Run test
if (require.main === module) {
  testPipeline().catch(error => {
    logger.error('❌ Test script failed', { error: error.message });
    process.exit(1);
  });
}

module.exports = { testPipeline };
