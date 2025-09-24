const express = require('express');
const { body, query, validationResult } = require('express-validator');
const axios = require('axios');
// Puppeteer removed for Railway deployment compatibility
const { query: dbQuery, transaction } = require('../database/connection');
const logger = require('../utils/logger');
const { analyzeSentiment } = require('../services/sentimentService');

const router = express.Router();

// Reddit API configuration
const REDDIT_API_BASE = 'https://www.reddit.com';
const REDDIT_USER_AGENT = 'UserFeedbackIntelligence/1.0';

/**
 * Scrape Reddit posts by subreddit and search terms
 * POST /api/reddit/scrape
 */
router.post('/scrape', [
  body('subreddit').isString().notEmpty().withMessage('Subreddit is required'),
  body('searchTerms').isArray({ min: 1 }).withMessage('At least one search term is required'),
  body('productId').isUUID().withMessage('Valid product ID is required'),
  body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subreddit, searchTerms, productId, limit = 25 } = req.body;
    
    logger.info('Starting Reddit scrape', { subreddit, searchTerms, productId });

    // Get platform ID for Reddit
    const platformResult = await dbQuery(
      'SELECT id FROM platforms WHERE name = $1',
      ['reddit']
    );
    
    if (platformResult.rows.length === 0) {
      return res.status(400).json({ error: 'Reddit platform not configured' });
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
      const scrapedData = await scrapeRedditPosts(subreddit, searchTerms, limit);
      
      // Store posts in database
      let postsScraped = 0;
      let commentsScraped = 0;

      for (const post of scrapedData.posts) {
        // Skip posts with no content
        if (!post.selftext && !post.title) {
          continue;
        }
        
        const content = post.selftext || post.title || 'No content available';
        const title = post.title || 'Untitled';
        
        const postResult = await dbQuery(
          `INSERT INTO posts (platform_id, product_id, external_id, title, content, author, url, score, comment_count, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (platform_id, external_id) DO UPDATE SET
           score = EXCLUDED.score, comment_count = EXCLUDED.comment_count
           RETURNING id`,
          [
            platformId, productId, post.id, title, content,
            post.author, post.url, post.score, post.num_comments, new Date(post.created_utc * 1000)
          ]
        );

        const postDbId = postResult.rows[0].id;
        postsScraped++;

        // Analyze sentiment for the post
        try {
          const sentiment = await analyzeSentiment(post.content);
          await dbQuery(
            `INSERT INTO sentiment_analysis (content_id, content_type, sentiment_score, sentiment_label, confidence, keywords)
             VALUES ($1, 'post', $2, $3, $4, $5)`,
            [postDbId, sentiment.score, sentiment.label, sentiment.confidence, sentiment.keywords]
          );
        } catch (sentimentError) {
          logger.warn('Sentiment analysis failed for post', { postId: postDbId, error: sentimentError.message });
        }

        // Scrape comments for this post
        if (post.num_comments > 0) {
          const comments = await scrapeRedditComments(post.id);
          for (const comment of comments) {
            await dbQuery(
              `INSERT INTO comments (post_id, external_id, content, author, score, created_at)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (post_id, external_id) DO UPDATE SET
               score = EXCLUDED.score`,
              [postDbId, comment.id, comment.body, comment.author, comment.score, new Date(comment.created_utc * 1000)]
            );
            commentsScraped++;

            // Analyze sentiment for comments
            try {
              const sentiment = await analyzeSentiment(comment.body);
              const commentResult = await dbQuery(
                'SELECT id FROM comments WHERE post_id = $1 AND external_id = $2',
                [postDbId, comment.id]
              );
              
              if (commentResult.rows.length > 0) {
                await dbQuery(
                  `INSERT INTO sentiment_analysis (content_id, content_type, sentiment_score, sentiment_label, confidence, keywords)
                   VALUES ($1, 'comment', $2, $3, $4, $5)`,
                  [commentResult.rows[0].id, sentiment.score, sentiment.label, sentiment.confidence, sentiment.keywords]
                );
              }
            } catch (sentimentError) {
              logger.warn('Sentiment analysis failed for comment', { commentId: comment.id, error: sentimentError.message });
            }
          }
        }
      }

      // Update job status
      await dbQuery(
        `UPDATE scraping_jobs SET status = 'completed', posts_scraped = $1, comments_scraped = $2, completed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [postsScraped, commentsScraped, jobId]
      );

      res.json({
        success: true,
        jobId,
        postsScraped,
        commentsScraped,
        message: `Successfully scraped ${postsScraped} posts and ${commentsScraped} comments`
      });

    } catch (scrapeError) {
      logger.error('Reddit scraping failed', { error: scrapeError.message, jobId });
      
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
    logger.error('Reddit scrape endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get Reddit scraping jobs status
 * GET /api/reddit/jobs
 */
router.get('/jobs', [
  query('productId').optional().isUUID().withMessage('Valid product ID required'),
  query('status').optional().isIn(['pending', 'running', 'completed', 'failed']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const { productId, status } = req.query;
    
    let query = `
      SELECT sj.*, p.name as product_name, pl.name as platform_name
      FROM scraping_jobs sj
      JOIN products p ON sj.product_id = p.id
      JOIN platforms pl ON sj.platform_id = pl.id
      WHERE pl.name = 'reddit'
    `;
    
    const params = [];
    let paramCount = 0;

    if (productId) {
      query += ` AND sj.product_id = $${++paramCount}`;
      params.push(productId);
    }

    if (status) {
      query += ` AND sj.status = $${++paramCount}`;
      params.push(status);
    }

    query += ' ORDER BY sj.created_at DESC LIMIT 50';

    const result = await dbQuery(query, params);
    
    res.json({
      jobs: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logger.error('Error fetching Reddit jobs', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get Reddit posts with sentiment analysis
 * GET /api/reddit/posts
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
      WHERE p.platform_id = (SELECT id FROM platforms WHERE name = 'reddit')
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
    logger.error('Error fetching Reddit posts', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to scrape Reddit posts
async function scrapeRedditPosts(subreddit, searchTerms, limit) {
  const posts = [];
  
  for (const term of searchTerms) {
    try {
      const url = `${REDDIT_API_BASE}/r/${subreddit}/search.json?q=${encodeURIComponent(term)}&sort=relevance&limit=${limit}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': REDDIT_USER_AGENT
        },
        timeout: 10000
      });

      if (response.data && response.data.data && response.data.data.children) {
        const redditPosts = response.data.data.children.map(child => child.data);
        posts.push(...redditPosts);
      }

      // Rate limiting - Reddit allows 60 requests per minute
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      logger.warn('Failed to scrape Reddit posts for term', { term, error: error.message });
    }
  }

  return { posts: posts.slice(0, limit) };
}

// Helper function to scrape Reddit comments
async function scrapeRedditComments(postId) {
  try {
    const url = `${REDDIT_API_BASE}/comments/${postId}.json`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': REDDIT_USER_AGENT
      },
      timeout: 10000
    });

    if (response.data && response.data[1] && response.data[1].data && response.data[1].data.children) {
      return response.data[1].data.children.map(child => child.data).slice(0, 50); // Limit to 50 comments
    }

    return [];

  } catch (error) {
    logger.warn('Failed to scrape Reddit comments', { postId, error: error.message.message });
    return [];
  }
}

module.exports = router;
