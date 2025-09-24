#!/usr/bin/env node

/**
 * Automated Reddit Search Scheduler
 * 
 * This script sets up automated Reddit post searching with configurable schedules
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

class RedditSearchScheduler {
  constructor() {
    this.orchestrator = new PipelineOrchestrator();
    this.isRunning = false;
  }

  async start() {
    logger.info('🤖 Starting Automated Reddit Search Scheduler...');

    try {
      // Initialize the pipeline
      await this.orchestrator.initialize();
      logger.info('✅ Pipeline initialized successfully');

      // Define search configurations for different schedules
      const searchConfigs = {
        // WHOOP 5.0 posts every 2 hours
        whoop5: {
          subreddit: 'whoop',
          searchTerms: ['WHOOP 5.0', 'WHOOP 5', 'new WHOOP'],
          limit: 20,
          timeframe: 'day'
        },
        
        // General WHOOP posts every 4 hours
        whoopGeneral: {
          subreddit: 'whoop',
          searchTerms: ['WHOOP', 'whoop band', 'whoop strap'],
          limit: 15,
          timeframe: 'day'
        },
        
        // Fitness tracking posts every 6 hours
        fitnessTracking: {
          subreddit: 'fitness',
          searchTerms: ['fitness tracker', 'heart rate monitor', 'sleep tracking'],
          limit: 10,
          timeframe: 'day'
        }
      };

      // Schedule different searches
      this.scheduleSearch('whoop5', searchConfigs.whoop5, '0 */2 * * *'); // Every 2 hours
      this.scheduleSearch('whoopGeneral', searchConfigs.whoopGeneral, '0 */4 * * *'); // Every 4 hours
      this.scheduleSearch('fitnessTracking', searchConfigs.fitnessTracking, '0 */6 * * *'); // Every 6 hours

      // Schedule a daily comprehensive search
      this.scheduleSearch('dailyComprehensive', {
        subreddit: 'whoop',
        searchTerms: ['WHOOP', 'whoop band', 'whoop strap', 'WHOOP 5.0', 'sleep tracking', 'heart rate'],
        limit: 50,
        timeframe: 'week'
      }, '0 9 * * *'); // Daily at 9 AM

      logger.info('📅 All scheduled searches configured');
      logger.info('🔄 Scheduler is now running...');
      logger.info('⏰ Press Ctrl+C to stop');

      this.isRunning = true;

      // Keep the process alive
      process.on('SIGINT', async () => {
        logger.info('🛑 Stopping scheduler...');
        await this.stop();
        process.exit(0);
      });

      // Keep running
      setInterval(() => {
        if (this.isRunning) {
          const stats = this.orchestrator.getStats();
          logger.info('📊 Scheduler Status:', {
            totalRuns: stats.totalRuns,
            successfulRuns: stats.successfulRuns,
            failedRuns: stats.failedRuns,
            lastRun: stats.lastRun,
            totalScraped: stats.totalScraped
          });
        }
      }, 300000); // Log stats every 5 minutes

    } catch (error) {
      logger.error('❌ Failed to start scheduler:', error.message);
      process.exit(1);
    }
  }

  scheduleSearch(name, config, cronExpression) {
    logger.info(`📅 Scheduling ${name}: ${cronExpression}`);
    
    const job = this.orchestrator.schedulePipeline(name, config, cronExpression);
    
    job.on('scheduled', () => {
      logger.info(`⏰ ${name} job scheduled for next run`);
    });

    job.on('run', () => {
      logger.info(`🚀 Starting ${name} search...`);
    });

    job.on('success', (result) => {
      logger.info(`✅ ${name} completed successfully:`, {
        scraped: result.scraped,
        processed: result.processed,
        embedded: result.embedded,
        indexed: result.indexed
      });
    });

    job.on('error', (error) => {
      logger.error(`❌ ${name} failed:`, error.message);
    });
  }

  async stop() {
    logger.info('🛑 Stopping scheduler...');
    await this.orchestrator.cleanup();
    this.isRunning = false;
    logger.info('✅ Scheduler stopped');
  }
}

// Run the scheduler
if (require.main === module) {
  const scheduler = new RedditSearchScheduler();
  scheduler.start().catch(error => {
    logger.error('❌ Scheduler failed to start:', error.message);
    process.exit(1);
  });
}

module.exports = RedditSearchScheduler;
