const express = require('express');
const { body, query, validationResult } = require('express-validator');
const axios = require('axios');
const { query: dbQuery } = require('../database/connection');
const logger = require('../utils/logger');
const { analyzeSentiment } = require('../services/sentimentService');

const router = express.Router();

// Twitter API configuration (Note: Requires Twitter API v2 access)
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

/**
 * Scrape Twitter posts by search terms
 * POST /api/twitter/scrape
 */
router.post('/scrape', [
  body('searchTerms').isArray({ min: 1 }).withMessage('At least one search term is required'),
  body('productId').isUUID().withMessage('Valid product ID is required'),
  body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!TWITTER_BEARER_TOKEN) {
      return res.status(400).json({ error: 'Twitter API credentials not configured' });
    }

    const { searchTerms, productId, limit = 25 } = req.body;
    
    logger.info('Starting Twitter scrape', { searchTerms, productId });

    // Get platform ID for Twitter
    const platformResult = await dbQuery(
      'SELECT id FROM platforms WHERE name = $1',
      ['twitter']
    );
    
    if (platformResult.rows.length === 0) {
      return res.status(400).json({ error: 'Twitter platform not configured' });
    }
    
    const platformId = platformResult.rows[0].id;

    // Create scraping job
    const jobResult = await dbQuery(
      `INSERT INTO scraping_jobs (platform_id, product_id, search_terms, status) 
       VALUES ($1, $2, $3, 'running') RETURNING id`,
      [platformId, productId, searchTerms]
    );
    
    const jobId = jobResult.rows[0].id;

    try {
      const scrapedData = await scrapeTwitterPosts(searchTerms, limit);
      
      // Store posts in database
      let postsScraped = 0;

      for (const tweet of scrapedData.tweets) {
        const postResult = await dbQuery(
          `INSERT INTO posts (platform_id, product_id, external_id, title, content, author, url, score, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (platform_id, external_id) DO UPDATE SET
           score = EXCLUDED.score
           RETURNING id`,
          [
            platformId, productId, tweet.id, tweet.text.substring(0, 200), // Use first 200 chars as title
            tweet.text, tweet.author_id, `https://twitter.com/user/status/${tweet.id}`,
            tweet.public_metrics?.like_count || 0, new Date(tweet.created_at)
          ]
        );

        const postDbId = postResult.rows[0].id;
        postsScraped++;

        // Analyze sentiment for the tweet
        try {
          const sentiment = await analyzeSentiment(tweet.text);
          await dbQuery(
            `INSERT INTO sentiment_analysis (content_id, content_type, sentiment_score, sentiment_label, confidence, keywords)
             VALUES ($1, 'post', $2, $3, $4, $5)`,
            [postDbId, sentiment.score, sentiment.label, sentiment.confidence, sentiment.keywords]
          );
        } catch (sentimentError) {
          logger.warn('Sentiment analysis failed for tweet', { tweetId: tweet.id, error: sentimentError.message });
        }
      }

      // Update job status
      await dbQuery(
        `UPDATE scraping_jobs SET status = 'completed', posts_scraped = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [postsScraped, jobId]
      );

      res.json({
        success: true,
        jobId,
        postsScraped,
        message: `Successfully scraped ${postsScraped} tweets`
      });

    } catch (scrapeError) {
      logger.error('Twitter scraping failed', { error: scrapeError.message, jobId });
      
      await dbQuery(
        `UPDATE scraping_jobs SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [scrapeError.message, jobId]
      );

      res.status(500).json({
        error: 'Scraping failed',
        message: scrapeError.message
      });
    }

  } catch (error) {
    logger.error('Twitter scrape endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get Twitter posts with sentiment analysis
 * GET /api/twitter/posts
 */
router.get('/posts', [
  query('productId').isUUID().withMessage('Valid product ID required'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sentiment').optional().isIn(['positive', 'negative', 'neutral']).withMessage('Invalid sentiment filter')
], async (req, res) => {
  try {
    const { productId, limit = 25, sentiment } = req.query;
    
    let query = `
      SELECT p.*, sa.sentiment_score, sa.sentiment_label, sa.confidence, sa.keywords
      FROM posts p
      LEFT JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
      WHERE p.platform_id = (SELECT id FROM platforms WHERE name = 'twitter')
      AND p.product_id = $1
    `;
    
    const params = [productId];
    let paramCount = 1;

    if (sentiment) {
      query += ` AND sa.sentiment_label = $${++paramCount}`;
      params.push(sentiment);
    }

    query += ' ORDER BY p.created_at DESC LIMIT $' + (++paramCount);
    params.push(parseInt(limit));

    const result = await dbQuery(query, params);
    
    res.json({
      posts: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching Twitter posts', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get Twitter trending topics
 * GET /api/twitter/trending
 */
router.get('/trending', async (req, res) => {
  try {
    if (!TWITTER_BEARER_TOKEN) {
      return res.status(400).json({ error: 'Twitter API credentials not configured' });
    }

    const trendingTopics = await getTwitterTrendingTopics();
    
    res.json({
      trending: trendingTopics,
      count: trendingTopics.length
    });

  } catch (error) {
    logger.error('Error fetching Twitter trending topics', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to scrape Twitter posts
async function scrapeTwitterPosts(searchTerms, limit) {
  const tweets = [];
  
  for (const term of searchTerms) {
    try {
      const query = encodeURIComponent(term);
      const url = `${TWITTER_API_BASE}/tweets/search/recent?query=${query}&max_results=${Math.min(limit, 100)}&tweet.fields=created_at,public_metrics,author_id`;
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.data) {
        tweets.push(...response.data.data);
      }

      // Rate limiting - Twitter API v2 has rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      logger.warn('Failed to scrape Twitter posts for term', { term, error: error.message });
    }
  }

  return { tweets: tweets.slice(0, limit) };
}

// Helper function to get trending topics
async function getTwitterTrendingTopics() {
  try {
    const url = `${TWITTER_API_BASE}/trends/by/woeid/1`; // Worldwide trends
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data && response.data[0] && response.data[0].trends) {
      return response.data[0].trends.slice(0, 20); // Return top 20 trends
    }

    return [];

  } catch (error) {
    logger.warn('Failed to fetch Twitter trending topics', { error: error.message });
    return [];
  }
}

module.exports = router;
