/**
 * ETL Pipeline Orchestrator
 * 
 * Coordinates the entire scraping + ETL pipeline:
 * Reddit Scraper → Text Cleaner → PostgreSQL → OpenAI Embeddings → Supabase Vector DB
 */

const ETLPipeline = require('./etlPipeline');
const RedditScraper = require('./redditScraper');
const TextCleaner = require('./textCleaner');
const EmbeddingsService = require('./embeddingsService');
const SupabaseVectorService = require('./supabaseVectorService');
const winston = require('winston');
const cron = require('node-cron');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'pipeline-orchestrator.log' })
  ]
});

class PipelineOrchestrator {
  constructor() {
    this.services = {
      redditScraper: null,
      textCleaner: null,
      embeddingsService: null,
      supabaseVectorService: null
    };
    
    this.isInitialized = false;
    this.isRunning = false;
    this.scheduledJobs = [];
    
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRun: null,
      lastSuccess: null,
      lastError: null,
      totalScraped: 0,
      totalProcessed: 0,
      totalEmbedded: 0,
      totalIndexed: 0
    };
  }

  /**
   * Initialize all pipeline services
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('⚠️ Pipeline already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing Pipeline Orchestrator...');

      // Initialize services
      this.services.redditScraper = new RedditScraper();
      this.services.textCleaner = new TextCleaner();
      this.services.embeddingsService = new EmbeddingsService();
      this.services.supabaseVectorService = new SupabaseVectorService();

      // Initialize each service
      await this.services.embeddingsService.initialize();
      await this.services.supabaseVectorService.initialize();

      this.isInitialized = true;
      logger.info('✅ Pipeline Orchestrator initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize Pipeline Orchestrator', { error: error.message });
      throw error;
    }
  }

  /**
   * Run the complete ETL pipeline
   */
  async runPipeline(config = {}) {
    if (!this.isInitialized) {
      throw new Error('Pipeline not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      logger.warn('⚠️ Pipeline is already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.stats.totalRuns++;
    this.stats.lastRun = new Date();

    const runId = `run-${Date.now()}`;
    logger.info(`🔄 Starting pipeline run: ${runId}`, { config });

    try {
      // Step 1: Scrape Reddit data
      const rawData = await this.scrapeData(config);
      this.stats.totalScraped += rawData.length;

      // Step 2: Clean and process text
      const processedData = await this.processText(rawData);
      this.stats.totalProcessed += processedData.length;

      // Step 3: Generate embeddings
      const embeddedData = await this.generateEmbeddings(processedData);
      this.stats.totalEmbedded += embeddedData.length;

      // Step 4: Index in Supabase Vector DB
      const indexingResults = await this.indexEmbeddings(embeddedData);
      this.stats.totalIndexed += indexingResults.indexed;

      this.stats.successfulRuns++;
      this.stats.lastSuccess = new Date();
      this.stats.lastError = null;

      logger.info(`✅ Pipeline run ${runId} completed successfully`, {
        scraped: rawData.length,
        processed: processedData.length,
        embedded: embeddedData.length,
        indexed: indexingResults.indexed,
        stats: this.stats
      });

      return {
        runId,
        success: true,
        stats: {
          scraped: rawData.length,
          processed: processedData.length,
          embedded: embeddedData.length,
          indexed: indexingResults.indexed,
          failed: indexingResults.failed
        }
      };

    } catch (error) {
      this.stats.failedRuns++;
      this.stats.lastError = error.message;

      logger.error(`❌ Pipeline run ${runId} failed`, { 
        error: error.message,
        stats: this.stats 
      });

      return {
        runId,
        success: false,
        error: error.message,
        stats: this.stats
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Step 1: Scrape Reddit data
   */
  async scrapeData(config) {
    logger.info('🔍 Step 1: Scraping Reddit data...');
    
    const defaultConfig = {
      subreddit: 'whoop',
      searchTerms: ['WHOOP 5.0', 'WHOOP 4.0', 'WHOOP band'],
      limit: 100,
      timeframe: 'month',
      sort: 'new'
    };

    const scrapeConfig = { ...defaultConfig, ...config.scraping };
    
    const rawData = await this.services.redditScraper.scrapePosts(scrapeConfig);
    
    logger.info(`✅ Scraped ${rawData.length} Reddit posts`);
    return rawData;
  }

  /**
   * Step 2: Process and clean text
   */
  async processText(rawData) {
    logger.info('🧹 Step 2: Processing and cleaning text...');
    
    const processedData = await this.services.textCleaner.cleanTextData(rawData);
    
    logger.info(`✅ Processed ${processedData.length} text items`);
    return processedData;
  }

  /**
   * Step 3: Generate embeddings
   */
  async generateEmbeddings(processedData) {
    logger.info('🤖 Step 3: Generating embeddings...');
    
    const embeddedData = await this.services.embeddingsService.generateEmbeddings(processedData);
    
    logger.info(`✅ Generated ${embeddedData.length} embeddings`);
    return embeddedData;
  }

  /**
   * Step 4: Index embeddings in Supabase
   */
  async indexEmbeddings(embeddedData) {
    logger.info('🔍 Step 4: Indexing embeddings in Supabase...');
    
    const indexingResults = await this.services.supabaseVectorService.indexEmbeddings(embeddedData);
    
    logger.info(`✅ Indexed ${indexingResults.indexed} embeddings`);
    return indexingResults;
  }

  /**
   * Schedule pipeline to run periodically
   */
  schedulePipeline(cronExpression = '0 */6 * * *', config = {}) {
    logger.info(`⏰ Scheduling pipeline with cron: ${cronExpression}`);

    const job = cron.schedule(cronExpression, async () => {
      try {
        await this.runPipeline(config);
      } catch (error) {
        logger.error('❌ Scheduled pipeline run failed', { error: error.message });
      }
    }, {
      scheduled: false
    });

    this.scheduledJobs.push({
      cronExpression,
      config,
      job
    });

    job.start();
    logger.info('✅ Pipeline scheduled successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stopScheduledJobs() {
    logger.info('⏹️ Stopping scheduled pipeline jobs...');
    
    this.scheduledJobs.forEach(({ job, cronExpression }) => {
      job.stop();
      logger.info(`✅ Stopped job: ${cronExpression}`);
    });

    this.scheduledJobs = [];
    logger.info('✅ All scheduled jobs stopped');
  }

  /**
   * Run pipeline with custom configuration
   */
  async runCustomPipeline(config) {
    const customConfig = {
      scraping: {
        subreddit: config.subreddit || 'whoop',
        searchTerms: config.searchTerms || ['WHOOP 5.0'],
        limit: config.limit || 50,
        timeframe: config.timeframe || 'week',
        sort: config.sort || 'new'
      },
      processing: {
        batchSize: config.batchSize || 100,
        enableEntityExtraction: config.enableEntityExtraction !== false,
        enableKeywordExtraction: config.enableKeywordExtraction !== false
      },
      embeddings: {
        model: config.embeddingModel || 'text-embedding-ada-002',
        batchSize: config.embeddingBatchSize || 100
      },
      indexing: {
        batchSize: config.indexingBatchSize || 100,
        upsertMode: config.upsertMode !== false
      }
    };

    return await this.runPipeline(customConfig);
  }

  /**
   * Perform similarity search
   */
  async searchSimilar(query, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Pipeline not initialized');
    }

    logger.info('🔍 Performing similarity search...', { query: query.substring(0, 100) });

    try {
      const results = await this.services.supabaseVectorService.searchByText(query, options);
      
      logger.info(`✅ Found ${results.length} similar items`);
      return results;

    } catch (error) {
      logger.error('❌ Similarity search failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      ...this.stats,
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      scheduledJobs: this.scheduledJobs.length,
      uptime: process.uptime()
    };
  }

  /**
   * Get service-specific statistics
   */
  async getServiceStats() {
    const serviceStats = {};

    try {
      if (this.services.supabaseVectorService) {
        serviceStats.supabase = await this.services.supabaseVectorService.getStats();
      }

      if (this.services.embeddingsService) {
        serviceStats.embeddings = {
          model: this.services.embeddingsService.model,
          maxTokens: this.services.embeddingsService.maxTokens
        };
      }

    } catch (error) {
      logger.error('❌ Failed to get service stats', { error: error.message });
    }

    return serviceStats;
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {},
      stats: this.getStats()
    };

    try {
      // Check each service
      if (this.services.embeddingsService) {
        health.services.embeddings = 'healthy';
      }

      if (this.services.supabaseVectorService) {
        const supabaseStats = await this.services.supabaseVectorService.getStats();
        health.services.supabase = supabaseStats.error ? 'unhealthy' : 'healthy';
      }

    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
    }

    return health;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    logger.info('🧹 Cleaning up Pipeline Orchestrator...');
    
    // Stop scheduled jobs
    this.stopScheduledJobs();
    
    // Cleanup services
    if (this.services.supabaseVectorService) {
      // Supabase client doesn't need explicit cleanup
    }

    this.isInitialized = false;
    logger.info('✅ Pipeline Orchestrator cleanup completed');
  }
}

module.exports = PipelineOrchestrator;
