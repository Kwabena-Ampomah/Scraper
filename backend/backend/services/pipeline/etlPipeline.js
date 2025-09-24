/**
 * Scraping + ETL Pipeline Service
 * 
 * Architecture:
 * 1. Reddit Scraper → Raw Data
 * 2. Text Cleaner → Processed Text
 * 3. PostgreSQL Storage → Structured Data
 * 4. OpenAI Embeddings → Vector Representations
 * 5. Supabase Vector DB → Searchable Index
 * 
 * Based on spec.md requirements for User Feedback Intelligence Platform
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');
const cron = require('node-cron');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'etl-pipeline.log' })
  ]
});

class ETLPipeline {
  constructor() {
    this.pgPool = null;
    this.openai = null;
    this.supabase = null;
    this.isRunning = false;
    this.stats = {
      totalScraped: 0,
      totalProcessed: 0,
      totalEmbedded: 0,
      totalIndexed: 0,
      errors: 0,
      lastRun: null
    };
  }

  /**
   * Initialize all services
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing ETL Pipeline...');
      
      // Initialize PostgreSQL connection
      await this.initializePostgreSQL();
      
      // Initialize OpenAI client
      await this.initializeOpenAI();
      
      // Initialize Supabase client
      await this.initializeSupabase();
      
      logger.info('✅ ETL Pipeline initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize ETL Pipeline', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL connection
   */
  async initializePostgreSQL() {
    this.pgPool = new Pool({
      user: process.env.DB_USER || 'kwabena',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'feedback_intelligence',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await this.pgPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('📊 PostgreSQL connection established');
  }

  /**
   * Initialize OpenAI client
   */
  async initializeOpenAI() {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not provided - AI features will be disabled');
      this.openai = null;
      return;
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Test connection
    try {
      await this.openai.models.list();
      logger.info('🤖 OpenAI client initialized');
    } catch (error) {
      logger.warn('🤖 OpenAI connection failed, continuing without AI features');
      this.openai = null;
    }
  }

  /**
   * Initialize Supabase client
   */
  async initializeSupabase() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Test connection
    const { data, error } = await this.supabase.from('embeddings').select('count').limit(1);
    if (error && !error.message.includes('relation "embeddings" does not exist')) {
      throw error;
    }
    
    logger.info('🔍 Supabase client initialized');
  }

  /**
   * Main ETL pipeline execution
   */
  async runPipeline(config = {}) {
    if (this.isRunning) {
      logger.warn('⚠️ Pipeline is already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.stats.lastRun = new Date();

    try {
      logger.info('🔄 Starting ETL Pipeline execution...', { config });

      // Step 1: Scrape Reddit data
      const rawData = await this.scrapeRedditData(config);
      this.stats.totalScraped += rawData.length;

      // Step 2: Clean and process text
      const processedData = await this.cleanTextData(rawData);
      this.stats.totalProcessed += processedData.length;

      // Step 3: Store in PostgreSQL
      await this.storeInPostgreSQL(processedData);

      // Step 4: Generate embeddings
      const embeddedData = await this.generateEmbeddings(processedData);
      this.stats.totalEmbedded += embeddedData.length;

      // Step 5: Index in Supabase Vector DB
      await this.indexInSupabase(embeddedData);
      this.stats.totalIndexed += embeddedData.length;

      logger.info('✅ ETL Pipeline completed successfully', { stats: this.stats });

    } catch (error) {
      this.stats.errors++;
      logger.error('❌ ETL Pipeline failed', { error: error.message, stats: this.stats });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Scrape Reddit data using Reddit API
   */
  async scrapeRedditData(config) {
    const {
      subreddit = 'whoop',
      searchTerms = ['WHOOP 5.0'],
      limit = 100,
      timeframe = 'month'
    } = config;

    logger.info('🔍 Scraping Reddit data...', { subreddit, searchTerms, limit });

    const scrapedData = [];

    try {
      // Use Reddit API to fetch posts
      for (const term of searchTerms) {
        const response = await axios.get(`https://www.reddit.com/r/${subreddit}/search.json`, {
          params: {
            q: term,
            sort: 'new',
            limit: Math.min(limit, 100), // Reddit API limit
            t: timeframe,
            raw_json: 1
          },
          headers: {
            'User-Agent': 'FeedbackIntelligenceBot/1.0'
          },
          timeout: 30000
        });

        const posts = response.data.data.children.map(child => ({
          id: child.data.id,
          title: child.data.title,
          content: child.data.selftext || '',
          author: child.data.author,
          url: `https://reddit.com${child.data.permalink}`,
          score: child.data.score,
          commentCount: child.data.num_comments,
          createdAt: new Date(child.data.created_utc * 1000),
          subreddit: child.data.subreddit,
          searchTerm: term,
          platform: 'reddit',
          rawData: child.data
        }));

        scrapedData.push(...posts);
        logger.info(`📊 Scraped ${posts.length} posts for term: ${term}`);
      }

      return scrapedData;

    } catch (error) {
      logger.error('❌ Reddit scraping failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Clean and preprocess text data
   */
  async cleanTextData(rawData) {
    logger.info('🧹 Cleaning and preprocessing text data...');

    const processedData = rawData.map(item => {
      // Combine title and content
      const fullText = `${item.title} ${item.content}`.trim();
      
      // Basic text cleaning
      const cleanedText = fullText
        .replace(/[^\w\s.,!?;:'"()-]/g, ' ') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Extract keywords (simple approach)
      const keywords = this.extractKeywords(cleanedText);

      return {
        ...item,
        cleanedText,
        textLength: cleanedText.length,
        keywords,
        processedAt: new Date()
      };
    });

    logger.info(`✅ Processed ${processedData.length} text items`);
    return processedData;
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text) {
    // Simple keyword extraction - in production, use NLP libraries
    const words = text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Return top keywords
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Check if word is a stop word
   */
  isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these',
      'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
      'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
    ]);
    return stopWords.has(word);
  }

  /**
   * Store processed data in PostgreSQL
   */
  async storeInPostgreSQL(processedData) {
    logger.info('💾 Storing data in PostgreSQL...');

    const client = await this.pgPool.connect();

    try {
      await client.query('BEGIN');

      for (const item of processedData) {
        // Insert or update post
        await client.query(`
          INSERT INTO posts (
            platform_id, product_id, external_id, title, content, 
            author, url, score, comment_count, created_at, metadata
          ) VALUES (
            (SELECT id FROM platforms WHERE name = $1),
            (SELECT id FROM products WHERE name = 'WHOOP 5.0'),
            $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
          ON CONFLICT (platform_id, external_id) 
          DO UPDATE SET 
            score = EXCLUDED.score,
            comment_count = EXCLUDED.comment_count,
            updated_at = NOW()
          RETURNING id
        `, [
          item.platform,
          item.id,
          item.title,
          item.cleanedText,
          item.author,
          item.url,
          item.score,
          item.commentCount,
          item.createdAt,
          JSON.stringify({
            searchTerm: item.searchTerm,
            keywords: item.keywords,
            textLength: item.textLength,
            processedAt: item.processedAt
          })
        ]);
      }

      await client.query('COMMIT');
      logger.info(`✅ Stored ${processedData.length} items in PostgreSQL`);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('❌ PostgreSQL storage failed', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate OpenAI embeddings for text
   */
  async generateEmbeddings(processedData) {
    logger.info('🤖 Generating OpenAI embeddings...');

    const embeddedData = [];

    for (const item of processedData) {
      try {
        // Truncate text to fit OpenAI limits (max 8192 tokens ≈ 6000 chars)
        const textToEmbed = item.cleanedText.substring(0, 6000);

        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: textToEmbed,
        });

        const embedding = response.data[0].embedding;

        embeddedData.push({
          ...item,
          embedding,
          embeddingModel: 'text-embedding-ada-002',
          embeddingTokens: response.usage.total_tokens
        });

        logger.debug(`📊 Generated embedding for: ${item.title.substring(0, 50)}...`);

      } catch (error) {
        logger.error('❌ Embedding generation failed', { 
          error: error.message, 
          title: item.title 
        });
        // Continue with other items
      }
    }

    logger.info(`✅ Generated ${embeddedData.length} embeddings`);
    return embeddedData;
  }

  /**
   * Index embeddings in Supabase Vector DB
   */
  async indexInSupabase(embeddedData) {
    logger.info('🔍 Indexing embeddings in Supabase...');

    try {
      for (const item of embeddedData) {
        // Store in Supabase embeddings table
        const { error } = await this.supabase
          .from('embeddings')
          .upsert({
            content_id: item.id,
            content_type: 'post',
            content_text: item.cleanedText,
            embedding: item.embedding,
            metadata: {
              title: item.title,
              author: item.author,
              platform: item.platform,
              keywords: item.keywords,
              searchTerm: item.searchTerm,
              embeddingModel: item.embeddingModel,
              embeddingTokens: item.embeddingTokens
            },
            created_at: new Date().toISOString()
          });

        if (error) {
          logger.error('❌ Supabase indexing failed', { 
            error: error.message, 
            contentId: item.id 
          });
        }
      }

      logger.info(`✅ Indexed ${embeddedData.length} embeddings in Supabase`);

    } catch (error) {
      logger.error('❌ Supabase indexing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Schedule pipeline to run periodically
   */
  schedulePipeline(cronExpression = '0 */6 * * *', config = {}) {
    logger.info(`⏰ Scheduling pipeline with cron: ${cronExpression}`);

    cron.schedule(cronExpression, async () => {
      try {
        await this.runPipeline(config);
      } catch (error) {
        logger.error('❌ Scheduled pipeline run failed', { error: error.message });
      }
    });
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      uptime: process.uptime()
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    logger.info('🧹 Cleaning up ETL Pipeline resources...');
    
    if (this.pgPool) {
      await this.pgPool.end();
    }
    
    logger.info('✅ ETL Pipeline cleanup completed');
  }
}

module.exports = ETLPipeline;
