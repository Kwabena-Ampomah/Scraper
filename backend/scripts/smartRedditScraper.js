#!/usr/bin/env node

/**
 * Smart Reddit Scraper with Product Mapping
 * 
 * Uses product-subreddit mappings to automatically assign posts
 * to the correct product for dashboard analytics
 */

require('dotenv').config();
const RedditScraper = require('../backend/services/pipeline/redditScraper');
const ProductMappingService = require('../services/productMappingService');
const { query: dbQuery } = require('../database/connection');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

async function smartScrapeReddit() {
  logger.info('🤖 Starting smart Reddit scraper with product mapping...');

  try {
    // Step 1: Setup database and get platform ID
    const setupResult = await setupDatabase();
    const { platformId } = setupResult;

    // Step 2: Add product mappings if they don't exist
    await ensureProductMappings();

    // Step 3: Show current mappings
    await showCurrentMappings();

    // Step 4: Scrape data for each product
    const scrapingResults = await scrapeAllProducts(platformId);

    // Step 5: Show results and provide dashboard URLs
    await showResults(scrapingResults);

    logger.info('🎉 Smart scraping completed!');

  } catch (error) {
    logger.error('❌ Smart scraping failed:', error.message);
    process.exit(1);
  }
}

async function setupDatabase() {
  logger.info('🔧 Setting up database...');

  // Run the migration to add subreddit column
  try {
    const fs = require('fs');
    const migrationSQL = fs.readFileSync('./database/add_subreddit_mapping.sql', 'utf8');
    await dbQuery(migrationSQL);
    logger.info('✅ Database migration completed');
  } catch (error) {
    logger.warn('⚠️ Migration may have already been run:', error.message);
  }

  // Get platform ID
  let platformResult = await dbQuery(`SELECT id FROM platforms WHERE name = 'reddit'`);
  let platformId;
  
  if (platformResult.rows.length === 0) {
    const newPlatform = await dbQuery(
      `INSERT INTO platforms (name, api_endpoint, rate_limit_per_hour) 
       VALUES ('reddit', 'https://www.reddit.com', 1000) 
       RETURNING id`
    );
    platformId = newPlatform.rows[0].id;
    logger.info('✅ Reddit platform created');
  } else {
    platformId = platformResult.rows[0].id;
    logger.info('✅ Reddit platform found');
  }

  return { platformId };
}

async function ensureProductMappings() {
  logger.info('📋 Ensuring product mappings exist...');

  const mappings = [
    {
      company: 'WHOOP Inc.',
      product: 'WHOOP 5.0',
      version: '5.0',
      subreddit: 'whoop',
      description: 'Advanced fitness and health monitoring wearable device'
    },
    {
      company: 'Apple Inc.',
      product: 'Apple Watch',
      version: 'Series 9',
      subreddit: 'AppleWatch',
      description: 'Smart fitness and health tracking watch'
    }
  ];

  for (const mapping of mappings) {
    try {
      await ProductMappingService.addMapping(
        mapping.company,
        mapping.product,
        mapping.version,
        mapping.subreddit,
        mapping.description
      );
    } catch (error) {
      logger.warn(`⚠️ Mapping may already exist for ${mapping.product}:`, error.message);
    }
  }
}

async function showCurrentMappings() {
  logger.info('📊 Current product-subreddit mappings:');
  const mappings = await ProductMappingService.getAllMappings();
  
  mappings.forEach(mapping => {
    logger.info(`  📱 ${mapping.name} (${mapping.company_name}) → r/${mapping.subreddit}`);
    logger.info(`      UUID: ${mapping.id}`);
  });
}

async function scrapeAllProducts(platformId) {
  logger.info('🔍 Starting scraping for all products...');
  
  const scraper = new RedditScraper();
  const results = [];

  // Scrape WHOOP data
  logger.info('🏃‍♂️ Scraping WHOOP 5.0 data...');
  const whoopPosts = await scraper.scrapePosts({
    subreddit: 'whoop',
    searchTerms: ['WHOOP 5.0', 'battery life', 'sleep tracking'],
    limit: 10,
    timeframe: 'month'
  });

  let whoopSaved = 0;
  for (const post of whoopPosts) {
    const saved = await ProductMappingService.saveRedditPost({ ...post, subreddit: 'whoop' }, platformId);
    if (saved) whoopSaved++;
  }

  results.push({
    product: 'WHOOP 5.0',
    subreddit: 'whoop',
    scraped: whoopPosts.length,
    saved: whoopSaved
  });

  // Scrape Apple Watch data
  logger.info('⌚ Scraping Apple Watch data...');
  const applePosts = await scraper.scrapePosts({
    subreddit: 'AppleWatch',
    searchTerms: ['Apple Watch', 'fitness tracking', 'heart rate'],
    limit: 10,
    timeframe: 'month'
  });

  let appleSaved = 0;
  for (const post of applePosts) {
    const saved = await ProductMappingService.saveRedditPost({ ...post, subreddit: 'AppleWatch' }, platformId);
    if (saved) appleSaved++;
  }

  results.push({
    product: 'Apple Watch',
    subreddit: 'AppleWatch',
    scraped: applePosts.length,
    saved: appleSaved
  });

  return results;
}

async function showResults(results) {
  logger.info('📈 Scraping Results:');
  
  for (const result of results) {
    logger.info(`  ${result.product}:`);
    logger.info(`    📊 Scraped: ${result.scraped} posts`);
    logger.info(`    💾 Saved: ${result.saved} posts`);
    
    // Get product ID for dashboard URL
    const productId = await ProductMappingService.getProductIdBySubreddit(result.subreddit);
    if (productId) {
      logger.info(`    🌐 Dashboard: http://localhost:3001/api/insights/dashboard/${productId}`);
    }
    logger.info('');
  }

  // Show all available dashboard URLs
  logger.info('🎯 Available Dashboards:');
  const mappings = await ProductMappingService.getAllMappings();
  mappings.forEach(mapping => {
    logger.info(`  📱 ${mapping.name}: http://localhost:3001/api/insights/dashboard/${mapping.id}`);
  });
}

// Run if called directly
if (require.main === module) {
  smartScrapeReddit().catch(error => {
    logger.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { smartScrapeReddit };
