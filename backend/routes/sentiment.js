const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const logger = require('../utils/logger');
const { analyzeSentiment, getSentimentStatistics } = require('../services/sentimentService');

const router = express.Router();

/**
 * Analyze sentiment for a single text
 * POST /api/sentiment/analyze
 */
router.post('/analyze', [
  body('text').isString().notEmpty().withMessage('Text is required'),
  body('contentType').optional().isIn(['post', 'comment']).withMessage('Invalid content type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { text, contentType = 'post' } = req.body;
    
    logger.info('Analyzing sentiment', { contentType, textLength: text.length });

    const result = await analyzeSentiment(text);
    
    res.json({
      success: true,
      result
    });

  } catch (error) {
    logger.error('Sentiment analysis endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Batch analyze multiple texts
 * POST /api/sentiment/batch
 */
router.post('/batch', [
  body('texts').isArray({ min: 1 }).withMessage('At least one text is required'),
  body('texts.*').isString().notEmpty().withMessage('Each text must be a non-empty string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { texts } = req.body;
    
    logger.info('Batch analyzing sentiment', { count: texts.length });

    const results = await Promise.all(
      texts.map(text => analyzeSentiment(text))
    );
    
    res.json({
      success: true,
      results,
      count: results.length
    });

  } catch (error) {
    logger.error('Batch sentiment analysis endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get sentiment statistics for a product
 * GET /api/sentiment/stats/:productId
 */
router.get('/stats/:productId', [
  query('platform').optional().isString().withMessage('Platform must be a string'),
  query('timeframe').optional().isIn(['24h', '7d', '30d', '90d', 'all']).withMessage('Invalid timeframe')
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { platform, timeframe = 'all' } = req.query;
    
    logger.info('Getting sentiment statistics', { productId, platform, timeframe });

    let query = `
      SELECT 
        COUNT(*) as total_posts,
        AVG(sentiment_score) as average_score,
        COUNT(CASE WHEN sentiment_label = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_count,
        COUNT(CASE WHEN sentiment_label = 'neutral' THEN 1 END) as neutral_count,
        STDDEV(sentiment_score) as score_stddev
      FROM posts p
      JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
      WHERE p.product_id = $1
    `;
    
    const params = [productId];
    let paramCount = 1;

    if (platform) {
      query += ` AND p.platform_id = (SELECT id FROM platforms WHERE name = $${++paramCount})`;
      params.push(platform);
    }

    if (timeframe !== 'all') {
      const timeMap = {
        '24h': '1 day',
        '7d': '7 days',
        '30d': '30 days',
        '90d': '90 days'
      };
      query += ` AND p.created_at >= NOW() - INTERVAL '${timeMap[timeframe]}'`;
    }

    const result = await dbQuery(query, params);
    const stats = result.rows[0];
    
    const statistics = {
      totalPosts: parseInt(stats.total_posts),
      averageScore: parseFloat(stats.average_score || 0),
      scoreStdDev: parseFloat(stats.score_stddev || 0),
      positiveCount: parseInt(stats.positive_count),
      negativeCount: parseInt(stats.negative_count),
      neutralCount: parseInt(stats.neutral_count),
      positivePercentage: stats.total_posts > 0 ? 
        (stats.positive_count / stats.total_posts * 100).toFixed(1) : 0,
      negativePercentage: stats.total_posts > 0 ? 
        (stats.negative_count / stats.total_posts * 100).toFixed(1) : 0,
      neutralPercentage: stats.total_posts > 0 ? 
        (stats.neutral_count / stats.total_posts * 100).toFixed(1) : 0
    };

    res.json({
      success: true,
      statistics,
      timeframe,
      platform: platform || 'all'
    });

  } catch (error) {
    logger.error('Sentiment statistics endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get sentiment trends over time
 * GET /api/sentiment/trends/:productId
 */
router.get('/trends/:productId', [
  query('platform').optional().isString().withMessage('Platform must be a string'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { platform, days = 30 } = req.query;
    
    logger.info('Getting sentiment trends', { productId, platform, days });

    let query = `
      SELECT 
        DATE(p.created_at) as date,
        COUNT(*) as post_count,
        AVG(sentiment_score) as average_score,
        COUNT(CASE WHEN sentiment_label = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_count,
        COUNT(CASE WHEN sentiment_label = 'neutral' THEN 1 END) as neutral_count
      FROM posts p
      JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
      WHERE p.product_id = $1
      AND p.created_at >= NOW() - INTERVAL '${days} days'
    `;
    
    const params = [productId];
    let paramCount = 1;

    if (platform) {
      query += ` AND p.platform_id = (SELECT id FROM platforms WHERE name = $${++paramCount})`;
      params.push(platform);
    }

    query += `
      GROUP BY DATE(p.created_at)
      ORDER BY date ASC
    `;

    const result = await dbQuery(query, params);
    
    const trends = result.rows.map(row => ({
      date: row.date,
      postCount: parseInt(row.post_count),
      averageScore: parseFloat(row.average_score || 0),
      positiveCount: parseInt(row.positive_count),
      negativeCount: parseInt(row.negative_count),
      neutralCount: parseInt(row.neutral_count),
      positivePercentage: row.post_count > 0 ? 
        (row.positive_count / row.post_count * 100).toFixed(1) : 0,
      negativePercentage: row.post_count > 0 ? 
        (row.negative_count / row.post_count * 100).toFixed(1) : 0
    }));

    res.json({
      success: true,
      trends,
      days: parseInt(days),
      platform: platform || 'all'
    });

  } catch (error) {
    logger.error('Sentiment trends endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get top keywords by sentiment
 * GET /api/sentiment/keywords/:productId
 */
router.get('/keywords/:productId', [
  query('sentiment').optional().isIn(['positive', 'negative', 'neutral']).withMessage('Invalid sentiment filter'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { sentiment, limit = 20 } = req.query;
    
    logger.info('Getting sentiment keywords', { productId, sentiment, limit });

    let query = `
      SELECT 
        keyword,
        COUNT(*) as frequency,
        AVG(sentiment_score) as average_sentiment,
        COUNT(CASE WHEN sentiment_label = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_count
      FROM posts p
      JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
      CROSS JOIN LATERAL unnest(sa.keywords) as keyword
      WHERE p.product_id = $1
    `;
    
    const params = [productId];
    let paramCount = 1;

    if (sentiment) {
      query += ` AND sa.sentiment_label = $${++paramCount}`;
      params.push(sentiment);
    }

    query += `
      GROUP BY keyword
      ORDER BY frequency DESC, average_sentiment DESC
      LIMIT $${++paramCount}
    `;
    params.push(parseInt(limit));

    const result = await dbQuery(query, params);
    
    const keywords = result.rows.map(row => ({
      keyword: row.keyword,
      frequency: parseInt(row.frequency),
      averageSentiment: parseFloat(row.average_sentiment || 0),
      positiveCount: parseInt(row.positive_count),
      negativeCount: parseInt(row.negative_count),
      sentimentDistribution: {
        positive: row.frequency > 0 ? (row.positive_count / row.frequency * 100).toFixed(1) : 0,
        negative: row.frequency > 0 ? (row.negative_count / row.frequency * 100).toFixed(1) : 0
      }
    }));

    res.json({
      success: true,
      keywords,
      count: keywords.length,
      sentiment: sentiment || 'all'
    });

  } catch (error) {
    logger.error('Sentiment keywords endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
