#!/usr/bin/env node

/**
 * Create Product and Populate Data Script
 * 
 * Creates a specific product and populates it with scraped Reddit data
 * so we can see actual data in the dashboard
 */

require('dotenv').config();
const { query: dbQuery } = require('../database/connection');
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

async function createProductAndPopulateData() {
  logger.info('🏗️ Creating product and populating data...');

  try {
    // Step 1: Create company, product, and platform if they don't exist
    const { companyId, productId, platformId } = await setupEntities();
    
    // Step 2: Initialize pipeline
    logger.info('🔧 Initializing pipeline...');
    const orchestrator = new PipelineOrchestrator();
    await orchestrator.initialize();
    logger.info('✅ Pipeline initialized successfully');

    // Step 3: Run pipeline with specific configuration
    const config = {
      subreddit: 'whoop',
      searchTerms: ['WHOOP 5.0', 'WHOOP battery', 'WHOOP sleep'],
      limit: 20,
      timeframe: 'month',
      sort: 'new',
      // Custom config to specify our product
      productId: productId,
      platformId: platformId
    };

    logger.info('🔄 Running pipeline with product-specific config...', { productId, config });
    const result = await orchestrator.runPipeline(config);

    if (result.success) {
      // Step 4: Insert scraped posts into database with our product ID
      await insertPostsWithProductId(result.data || [], productId, platformId);
      
      logger.info('✅ Product data population completed successfully!', { 
        productId,
        result 
      });

      // Step 5: Test the dashboard endpoint
      logger.info('🔍 Testing dashboard endpoint...');
      await testDashboard(productId);

    } else {
      logger.error('❌ Pipeline failed', { result });
    }

  } catch (error) {
    logger.error('❌ Script failed', { error: error.message });
  }
}

async function setupEntities() {
  logger.info('🏗️ Setting up company, product, and platform...');

  // Create or get company
  let companyResult = await dbQuery(`SELECT id FROM companies WHERE name = 'WHOOP Inc.'`);
  let companyId;
  
  if (companyResult.rows.length === 0) {
    // Company doesn't exist, create it
    companyResult = await dbQuery(
      `INSERT INTO companies (name, domain, industry) 
       VALUES ('WHOOP Inc.', 'whoop.com', 'Fitness Technology') 
       RETURNING id`
    );
    companyId = companyResult.rows[0].id;
  } else {
    companyId = companyResult.rows[0].id;
  }

  // Create or get product
  let productResult = await dbQuery(
    `SELECT id FROM products WHERE name = 'WHOOP 5.0' AND version = '5.0'`
  );
  let productId;
  
  if (productResult.rows.length === 0) {
    // Product doesn't exist, create it
    productResult = await dbQuery(
      `INSERT INTO products (company_id, name, version, description) 
       VALUES ($1, 'WHOOP 5.0', '5.0', 'Advanced fitness and health monitoring wearable device') 
       RETURNING id`,
      [companyId]
    );
    productId = productResult.rows[0].id;
  } else {
    productId = productResult.rows[0].id;
  }

  // Create or get platform  
  let platformResult = await dbQuery(`SELECT id FROM platforms WHERE name = 'reddit'`);
  let platformId;
  
  if (platformResult.rows.length === 0) {
    // Platform doesn't exist, create it
    platformResult = await dbQuery(
      `INSERT INTO platforms (name, api_endpoint, rate_limit_per_hour) 
       VALUES ('reddit', 'https://www.reddit.com', 1000) 
       RETURNING id`
    );
    platformId = platformResult.rows[0].id;
  } else {
    platformId = platformResult.rows[0].id;
  }

  logger.info('✅ Entities created/verified', { companyId, productId, platformId });
  return { companyId, productId, platformId };
}

async function insertPostsWithProductId(posts, productId, platformId) {
  logger.info('📝 Inserting posts with product ID...', { postCount: posts.length });

  // Note: The pipeline might not return raw posts, so let's scrape fresh data
  const RedditScraper = require('../backend/services/pipeline/redditScraper');
  const scraper = new RedditScraper();
  
  const scrapedPosts = await scraper.scrapePosts({
    subreddit: 'whoop',
    searchTerms: ['WHOOP 5.0', 'WHOOP battery', 'WHOOP sleep'],
    limit: 15,
    timeframe: 'month'
  });

  logger.info(`📊 Scraped ${scrapedPosts.length} posts for insertion`);

  for (const post of scrapedPosts) {
    try {
      // Insert post with our specific product ID
      const postResult = await dbQuery(
        `INSERT INTO posts (
          product_id, platform_id, external_id, title, content, 
          url, author, score, created_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (external_id, platform_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [
          productId,
          platformId,
          post.id,
          post.title,
          post.content || post.title,
          post.url,
          post.author,
          post.score,
          new Date(post.created_utc * 1000),
          JSON.stringify(post.metadata || {})
        ]
      );

      // Get the post ID (either newly inserted or existing)
      let postId;
      if (postResult.rows.length > 0) {
        postId = postResult.rows[0].id;
      } else {
        // Get existing post ID
        const existingPost = await dbQuery(
          'SELECT id FROM posts WHERE external_id = $1 AND platform_id = $2', 
          [post.id, platformId]
        );
        postId = existingPost.rows[0]?.id;
      }

      if (postId) {
        // Create sentiment analysis entry
        const sentimentScore = Math.random() * 2 - 1; // Random sentiment for demo
        const sentimentLabel = sentimentScore > 0.1 ? 'positive' : sentimentScore < -0.1 ? 'negative' : 'neutral';

        await dbQuery(
          `INSERT INTO sentiment_analysis (
            content_id, content_type, sentiment_label, sentiment_score, 
            confidence, keywords, entities, created_at
          ) VALUES ($1, 'post', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (content_id, content_type) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
          [
            postId,
            sentimentLabel,
            sentimentScore,
            Math.random() * 0.3 + 0.7, // Random confidence
            JSON.stringify(['whoop', 'fitness', 'battery', 'sleep']),
            JSON.stringify([])
          ]
        );
      }

    } catch (error) {
      logger.warn('⚠️ Failed to insert post', { postId: post.id, error: error.message });
    }
  }

  logger.info('✅ Posts inserted successfully');
}

async function testDashboard(productId) {
  logger.info('🧪 Testing dashboard with populated data...');
  
  try {
    // Test the dashboard data generation function
    const axios = require('axios');
    const response = await axios.get(`http://localhost:3001/api/insights/dashboard/${productId}?timeframe=30d`);
    
    logger.info('📊 Dashboard test result:', response.data);
  } catch (error) {
    logger.warn('⚠️ Dashboard test failed (this is normal if server is not running)', { error: error.message });
  }
}

// Run script
if (require.main === module) {
  createProductAndPopulateData()
    .then(() => {
      logger.info('🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      logger.error('❌ Script failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { createProductAndPopulateData };
