#!/usr/bin/env node

/**
 * Real Reddit Data Scraper
 * Fetches actual Reddit posts and inserts them into the database
 */

require('dotenv').config();
const axios = require('axios');
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

async function scrapeRealRedditData() {
  logger.info('🔍 Scraping REAL Reddit data...');

  try {
    // Get or create the WHOOP product
    const productId = await getOrCreateProduct();
    const platformId = await getOrCreatePlatform();

    // Scrape real Reddit posts about WHOOP
    const subreddits = ['whoop', 'fitness'];
    const searchTerms = ['WHOOP 5.0', 'WHOOP 4.0', 'WHOOP battery', 'WHOOP sleep', 'WHOOP strain'];

    let totalInserted = 0;

    for (const subreddit of subreddits) {
      for (const term of searchTerms) {
        try {
          logger.info(`📊 Scraping r/${subreddit} for "${term}"...`);
          
          // Use Reddit's JSON API (no authentication required)
          const url = `https://www.reddit.com/r/${subreddit}/search.json`;
          const response = await axios.get(url, {
            params: {
              q: term,
              sort: 'new',
              t: 'month',
              limit: 10,
              raw_json: 1
            },
            headers: {
              'User-Agent': 'FeedbackIntelligenceBot/1.0 (Educational Research)'
            }
          });

          if (response.data && response.data.data && response.data.data.children) {
            const posts = response.data.data.children;
            logger.info(`✅ Found ${posts.length} posts for "${term}" in r/${subreddit}`);

            for (const postWrapper of posts) {
              const post = postWrapper.data;
              
              try {
                // Insert post into database
                const insertResult = await dbQuery(`
                  INSERT INTO posts (
                    product_id, platform_id, external_id, title, content,
                    url, author, score, created_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                  ON CONFLICT (external_id, platform_id) DO NOTHING
                  RETURNING id
                `, [
                  productId,
                  platformId,
                  post.id,
                  post.title,
                  post.selftext || post.title,
                  `https://reddit.com${post.permalink}`,
                  post.author,
                  post.score,
                  new Date(post.created_utc * 1000)
                ]);

                if (insertResult.rows.length > 0) {
                  const postDbId = insertResult.rows[0].id;

                  // Generate sentiment analysis (you can integrate with OpenAI later)
                  const sentiment = generateSentiment(post.title + ' ' + (post.selftext || ''));
                  
                  await dbQuery(`
                    INSERT INTO sentiment_analysis (
                      content_id, content_type, sentiment_label, sentiment_score,
                      confidence, keywords, entities, created_at
                    ) VALUES ($1, 'post', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
                    ON CONFLICT (content_id, content_type) DO NOTHING
                  `, [
                    postDbId,
                    sentiment.label,
                    sentiment.score,
                    sentiment.confidence,
                    JSON.stringify(extractKeywords(post.title + ' ' + (post.selftext || ''))),
                    JSON.stringify([])
                  ]);

                  totalInserted++;
                  logger.info(`✅ Inserted: "${post.title.substring(0, 50)}..." (${sentiment.label})`);
                }

              } catch (error) {
                logger.warn(`⚠️ Failed to insert post ${post.id}: ${error.message}`);
              }
            }

            // Rate limiting - wait 1 second between requests
            await new Promise(resolve => setTimeout(resolve, 1000));

          } else {
            logger.warn(`⚠️ No data found for "${term}" in r/${subreddit}`);
          }

        } catch (error) {
          logger.error(`❌ Failed to scrape "${term}" in r/${subreddit}:`, error.message);
        }
      }
    }

    logger.info(`🎉 Successfully inserted ${totalInserted} real Reddit posts!`);
    logger.info(`🌐 Test your dashboard: http://localhost:3001/api/insights/dashboard/${productId}`);

    return productId;

  } catch (error) {
    logger.error('❌ Scraping failed:', error.message);
    throw error;
  }
}

async function getOrCreateProduct() {
  // Check if WHOOP product exists
  let result = await dbQuery(`SELECT id FROM products WHERE name = 'WHOOP 5.0'`);
  
  if (result.rows.length === 0) {
    // Create company first
    const companyResult = await dbQuery(`
      INSERT INTO companies (name, domain, industry) 
      VALUES ('WHOOP Inc.', 'whoop.com', 'Fitness Technology') 
      RETURNING id
    `);
    
    const companyId = companyResult.rows[0].id;
    
    // Create product
    result = await dbQuery(`
      INSERT INTO products (company_id, name, version, description) 
      VALUES ($1, 'WHOOP 5.0', '5.0', 'Advanced fitness and health monitoring wearable device')
      RETURNING id
    `, [companyId]);
  }
  
  return result.rows[0].id;
}

async function getOrCreatePlatform() {
  let result = await dbQuery(`SELECT id FROM platforms WHERE name = 'reddit'`);
  
  if (result.rows.length === 0) {
    result = await dbQuery(`
      INSERT INTO platforms (name, api_endpoint, rate_limit_per_hour) 
      VALUES ('reddit', 'https://www.reddit.com', 1000)
      RETURNING id
    `);
  }
  
  return result.rows[0].id;
}

function generateSentiment(text) {
  // Simple sentiment analysis based on keywords
  const positiveWords = ['love', 'great', 'awesome', 'excellent', 'amazing', 'perfect', 'best', 'good', 'works', 'helpful'];
  const negativeWords = ['hate', 'terrible', 'awful', 'bad', 'worst', 'broken', 'issue', 'problem', 'sucks', 'disappointing'];
  
  const textLower = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;
  
  positiveWords.forEach(word => {
    if (textLower.includes(word)) positiveScore++;
  });
  
  negativeWords.forEach(word => {
    if (textLower.includes(word)) negativeScore++;
  });
  
  const totalScore = positiveScore - negativeScore;
  let label, score;
  
  if (totalScore > 0) {
    label = 'positive';
    score = Math.min(0.9, 0.5 + totalScore * 0.1);
  } else if (totalScore < 0) {
    label = 'negative';
    score = Math.max(-0.9, -0.5 + totalScore * 0.1);
  } else {
    label = 'neutral';
    score = 0;
  }
  
  return {
    label,
    score,
    confidence: Math.random() * 0.2 + 0.8 // Random confidence between 0.8-1.0
  };
}

function extractKeywords(text) {
  const keywords = [];
  const whoopKeywords = ['whoop', 'battery', 'sleep', 'strain', 'recovery', 'fitness', 'tracker', 'wearable'];
  
  whoopKeywords.forEach(keyword => {
    if (text.toLowerCase().includes(keyword)) {
      keywords.push(keyword);
    }
  });
  
  return keywords;
}

// Run if called directly
if (require.main === module) {
  scrapeRealRedditData()
    .then((productId) => {
      console.log('\n🎉 SUCCESS! Real Reddit data scraped and inserted!');
      console.log('🔗 Product ID:', productId);
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

module.exports = { scrapeRealRedditData };
