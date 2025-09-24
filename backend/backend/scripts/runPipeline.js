#!/usr/bin/env node

/**
 * CLI Script to run the ETL Pipeline
 * 
 * Usage:
 *   node runPipeline.js [options]
 * 
 * Options:
 *   --subreddit <name>     Reddit subreddit to scrape (default: whoop)
 *   --terms <terms>        Comma-separated search terms (default: WHOOP 5.0)
 *   --limit <number>       Number of posts to scrape (default: 100)
 *   --timeframe <period>   Time period: day,week,month,year,all (default: month)
 *   --schedule <cron>      Cron expression for scheduling (optional)
 *   --once                 Run once and exit (default behavior)
 *   --help                 Show help
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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    subreddit: 'whoop',
    searchTerms: ['WHOOP 5.0'],
    limit: 100,
    timeframe: 'month',
    schedule: null,
    once: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--subreddit':
        config.subreddit = nextArg;
        i++;
        break;
      case '--terms':
        config.searchTerms = nextArg.split(',').map(term => term.trim());
        i++;
        break;
      case '--limit':
        config.limit = parseInt(nextArg);
        i++;
        break;
      case '--timeframe':
        config.timeframe = nextArg;
        i++;
        break;
      case '--schedule':
        config.schedule = nextArg;
        config.once = false;
        i++;
        break;
      case '--once':
        config.once = true;
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
      default:
        logger.warn(`Unknown argument: ${arg}`);
    }
  }

  return config;
}

function showHelp() {
  console.log(`
ETL Pipeline CLI

Usage: node runPipeline.js [options]

Options:
  --subreddit <name>     Reddit subreddit to scrape (default: whoop)
  --terms <terms>        Comma-separated search terms (default: WHOOP 5.0)
  --limit <number>       Number of posts to scrape (default: 100)
  --timeframe <period>   Time period: day,week,month,year,all (default: month)
  --schedule <cron>      Cron expression for scheduling (optional)
  --once                 Run once and exit (default behavior)
  --help                 Show this help

Examples:
  # Run once with default settings
  node runPipeline.js

  # Scrape different subreddit
  node runPipeline.js --subreddit fitness --terms "fitness tracker"

  # Scrape more posts from last week
  node runPipeline.js --limit 200 --timeframe week

  # Schedule to run every 6 hours
  node runPipeline.js --schedule "0 */6 * * *"

Cron Examples:
  "0 */6 * * *"     - Every 6 hours
  "0 0 * * *"       - Daily at midnight
  "0 0 * * 0"       - Weekly on Sunday
  "0 0 1 * *"       - Monthly on 1st
`);
}

async function main() {
  const config = parseArgs();
  
  logger.info('🚀 Starting ETL Pipeline CLI...', { config });

  const orchestrator = new PipelineOrchestrator();

  try {
    // Initialize pipeline
    await orchestrator.initialize();
    logger.info('✅ Pipeline initialized successfully');

    if (config.schedule) {
      // Schedule pipeline
      logger.info(`⏰ Scheduling pipeline with cron: ${config.schedule}`);
      orchestrator.schedulePipeline(config.schedule, config);
      
      logger.info('✅ Pipeline scheduled. Press Ctrl+C to stop.');
      
      // Keep process running
      process.on('SIGINT', async () => {
        logger.info('🛑 Shutting down pipeline...');
        await orchestrator.cleanup();
        process.exit(0);
      });

      // Keep alive
      setInterval(() => {
        const stats = orchestrator.getStats();
        logger.info('📊 Pipeline stats', { stats });
      }, 60000); // Log stats every minute

    } else {
      // Run once
      logger.info('🔄 Running pipeline once...');
      const result = await orchestrator.runCustomPipeline(config);
      
      if (result.success) {
        logger.info('✅ Pipeline completed successfully', { result });
      } else {
        logger.error('❌ Pipeline failed', { result });
        process.exit(1);
      }
    }

  } catch (error) {
    logger.error('❌ Pipeline failed to start', { error: error.message });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception', { error: error.message });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main().catch(error => {
    logger.error('❌ Main function failed', { error: error.message });
    process.exit(1);
  });
}

module.exports = { main, parseArgs, showHelp };
