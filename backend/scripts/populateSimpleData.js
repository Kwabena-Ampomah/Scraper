#!/usr/bin/env node

/**
 * Simple Data Population Script
 * Creates a simple product entry and populates with data
 */

require('dotenv').config();
const { query: dbQuery } = require('../database/connection');
const RedditScraper = require('../backend/services/pipeline/redditScraper');
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

async function populateSimpleData() {
  logger.info('🚀 Creating simple product data...');

  try {
    // Step 1: Create entities and get their IDs
    const result = await createEntitiesAndGetIds();
    const { companyId, productId, platformId } = result;

    logger.info('✅ Product created with ID:', productId);

    // Step 2: Scrape and insert posts
    await scrapeAndInsertPosts(productId, platformId);

    // Step 3: Test the API
    logger.info('🧪 Your product ID is:', productId);
    logger.info('🧪 Test your dashboard at:', `http://localhost:3001/api/insights/dashboard/${productId}`);
    logger.info('🧪 Or use this in your frontend URL');

    return productId;

  } catch (error) {
    logger.error('❌ Failed:', error.message);
    throw error;
  }
}

async function createEntitiesAndGetIds() {
  // Insert company
  const companyResult = await dbQuery(`
    INSERT INTO companies (name, domain, industry) 
    VALUES ('WHOOP Inc.', 'whoop.com', 'Fitness Technology') 
    RETURNING id
  `);
  const companyId = companyResult.rows[0].id;
  logger.info('✅ Company created:', companyId);

  // Insert product
  const productResult = await dbQuery(`
    INSERT INTO products (company_id, name, version, description) 
    VALUES ($1, 'WHOOP 5.0', '5.0', 'Fitness tracker with sleep and strain monitoring') 
    RETURNING id
  `, [companyId]);
  const productId = productResult.rows[0].id;
  logger.info('✅ Product created:', productId);

  // Get or create platform
  let platformResult = await dbQuery(`SELECT id FROM platforms WHERE name = 'reddit'`);
  let platformId;
  
  if (platformResult.rows.length === 0) {
    // Platform doesn't exist, create it
    platformResult = await dbQuery(`
      INSERT INTO platforms (name, api_endpoint, rate_limit_per_hour) 
      VALUES ('reddit', 'https://www.reddit.com', 1000) 
      RETURNING id
    `);
    platformId = platformResult.rows[0].id;
    logger.info('✅ Platform created:', platformId);
  } else {
    platformId = platformResult.rows[0].id;
    logger.info('✅ Platform found:', platformId);
  }

  return { companyId, productId, platformId };
}

async function scrapeAndInsertPosts(productId, platformId) {
  logger.info('📊 Scraping Reddit posts...');

  const scraper = new RedditScraper();
  const posts = await scraper.scrapePosts({
    subreddit: 'whoop',
    searchTerms: ['WHOOP 5.0', 'WHOOP battery', 'WHOOP sleep'],
    limit: 10,
    timeframe: 'month'
  });

  logger.info(`✅ Scraped ${posts.length} posts`);

  let insertedCount = 0;
  for (const post of posts) {
    try {
      // Insert post
      const postResult = await dbQuery(`
        INSERT INTO posts (
          product_id, platform_id, external_id, title, content, 
          url, author, score, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        productId,
        platformId,
        post.id,
        post.title,
        post.content || post.title,
        post.url,
        post.author,
        post.score,
        new Date() // Use current timestamp instead of Reddit timestamp
      ]);

      const postDbId = postResult.rows[0].id;

      // Insert sentiment (with demo data)
      const sentimentScore = (Math.random() - 0.5) * 2; // -1 to 1
      const sentimentLabel = sentimentScore > 0.1 ? 'positive' : sentimentScore < -0.1 ? 'negative' : 'neutral';

      await dbQuery(`
        INSERT INTO sentiment_analysis (
          content_id, content_type, sentiment_label, sentiment_score, 
          confidence, keywords, entities, created_at
        ) VALUES ($1, 'post', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `, [
        postDbId,
        sentimentLabel,
        sentimentScore,
        Math.random() * 0.3 + 0.7,
        JSON.stringify(['whoop', 'fitness', 'battery', 'sleep', 'tracker']),
        JSON.stringify([])
      ]);

      insertedCount++;
      logger.info(`📝 Inserted post ${insertedCount}/${posts.length}: ${post.title.substring(0, 50)}...`);

    } catch (error) {
      logger.warn(`⚠️ Failed to insert post ${post.id}: ${error.message}`);
    }
  }

  logger.info(`✅ Inserted ${insertedCount} posts with sentiment data`);
}

// Run if called directly
if (require.main === module) {
  populateSimpleData()
    .then((productId) => {
      console.log('\n🎉 SUCCESS! Your product ID is:');
      console.log('🔗', productId);
      console.log('\n📊 Test your dashboard:');
      console.log(`curl "http://localhost:3001/api/insights/dashboard/${productId}"`);
      console.log('\n🌐 Or open in browser:');
      console.log(`http://localhost:3001/api/insights/dashboard/${productId}?timeframe=30d`);
      process.exit(0);
    })
    .catch(error => {
      logger.error('❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { populateSimpleData };
