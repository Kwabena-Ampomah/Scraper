const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { query: dbQuery } = require('../database/connection');
const logger = require('../utils/logger');
const { generateEmbedding, searchSimilarContent } = require('../services/vectorService');

const router = express.Router();

/**
 * Semantic search using vector embeddings
 * POST /api/search/semantic
 */
router.post('/semantic', [
  body('query').isString().notEmpty().withMessage('Search query is required'),
  body('productId').optional().isUUID().withMessage('Valid product ID required'),
  body('platform').optional().isString().withMessage('Platform must be a string'),
  body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  body('threshold').optional().isFloat({ min: 0, max: 1 }).withMessage('Threshold must be between 0 and 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { query: searchQuery, productId, platform, limit = 20, threshold = 0.7 } = req.body;
    
    logger.info('Performing semantic search', { 
      query: searchQuery.substring(0, 100), 
      productId, 
      platform, 
      limit 
    });

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(searchQuery);
    
    // Search for similar content
    const results = await searchSimilarContent({
      embedding: queryEmbedding,
      productId,
      platform,
      limit,
      threshold
    });

    res.json({
      success: true,
      query: searchQuery,
      results,
      count: results.length,
      threshold
    });

  } catch (error) {
    logger.error('Semantic search endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Natural language query processing
 * POST /api/search/natural-language
 */
router.post('/natural-language', [
  body('query').isString().notEmpty().withMessage('Query is required'),
  body('productId').optional().isUUID().withMessage('Valid product ID required'),
  body('context').optional().isString().withMessage('Context must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { query: naturalQuery, productId, context } = req.body;
    
    logger.info('Processing natural language query', { 
      query: naturalQuery.substring(0, 100), 
      productId, 
      context 
    });

    // Parse the natural language query
    const parsedQuery = await parseNaturalLanguageQuery(naturalQuery, context);
    
    // Execute the parsed query
    const results = await executeNaturalLanguageQuery(parsedQuery, productId);

    res.json({
      success: true,
      originalQuery: naturalQuery,
      parsedQuery,
      results,
      count: results.length
    });

  } catch (error) {
    logger.error('Natural language search endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Search by keywords with fuzzy matching
 * GET /api/search/keywords
 */
router.get('/keywords', [
  query('q').isString().notEmpty().withMessage('Search query is required'),
  query('productId').optional().isUUID().withMessage('Valid product ID required'),
  query('platform').optional().isString().withMessage('Platform must be a string'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const { q, productId, platform, limit = 20 } = req.query;
    
    logger.info('Performing keyword search', { query: q, productId, platform });

    let query = `
      SELECT 
        p.id,
        p.title,
        p.content,
        p.author,
        p.score,
        p.created_at,
        p.url,
        sa.sentiment_score,
        sa.sentiment_label,
        sa.keywords,
        pr.name as product_name,
        pl.name as platform_name
      FROM posts p
      LEFT JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
      LEFT JOIN products pr ON p.product_id = pr.id
      LEFT JOIN platforms pl ON p.platform_id = pl.id
      WHERE (
        p.title ILIKE $1 OR 
        p.content ILIKE $1 OR
        sa.keywords::text ILIKE $1
      )
    `;
    
    const params = [`%${q}%`];
    let paramCount = 1;

    if (productId) {
      query += ` AND p.product_id = $${++paramCount}`;
      params.push(productId);
    }

    if (platform) {
      query += ` AND pl.name = $${++paramCount}`;
      params.push(platform);
    }

    query += ` ORDER BY p.score DESC, p.created_at DESC LIMIT $${++paramCount}`;
    params.push(parseInt(limit));

    const result = await dbQuery(query, params);
    
    res.json({
      success: true,
      query: q,
      results: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    logger.error('Keyword search endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Advanced search with multiple filters
 * POST /api/search/advanced
 */
router.post('/advanced', [
  body('filters').isObject().withMessage('Filters object is required'),
  body('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  body('sortBy').optional().isIn(['relevance', 'date', 'score', 'sentiment']).withMessage('Invalid sort option')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { filters, limit = 20, sortBy = 'relevance' } = req.body;
    
    logger.info('Performing advanced search', { filters, limit, sortBy });

    const results = await performAdvancedSearch(filters, limit, sortBy);

    res.json({
      success: true,
      filters,
      results,
      count: results.length,
      sortBy
    });

  } catch (error) {
    logger.error('Advanced search endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get search suggestions
 * GET /api/search/suggestions
 */
router.get('/suggestions', [
  query('q').isString().notEmpty().withMessage('Query is required'),
  query('productId').optional().isUUID().withMessage('Valid product ID required'),
  query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20')
], async (req, res) => {
  try {
    const { q, productId, limit = 10 } = req.query;
    
    logger.info('Getting search suggestions', { query: q, productId });

    const suggestions = await getSearchSuggestions(q, productId, limit);

    res.json({
      success: true,
      query: q,
      suggestions,
      count: suggestions.length
    });

  } catch (error) {
    logger.error('Search suggestions endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions

/**
 * Parse natural language query into structured format
 */
async function parseNaturalLanguageQuery(query, context) {
  // Simple NLP parsing - in production, you'd use more sophisticated NLP
  const lowerQuery = query.toLowerCase();
  
  const parsed = {
    intent: 'search',
    entities: [],
    filters: {},
    timeRange: null
  };

  // Extract entities (product names, features, etc.)
  const entityPatterns = [
    /(?:about|regarding|concerning)\s+([^?]+)/i,
    /(?:what|how|why)\s+(?:are|do|does)\s+(?:users|people)\s+(?:saying|think)\s+(?:about|regarding)\s+([^?]+)/i,
    /(?:opinions|feedback|reviews)\s+(?:on|about)\s+([^?]+)/i
  ];

  for (const pattern of entityPatterns) {
    const match = query.match(pattern);
    if (match) {
      parsed.entities.push(match[1].trim());
    }
  }

  // Extract sentiment filters
  if (lowerQuery.includes('positive') || lowerQuery.includes('good') || lowerQuery.includes('love')) {
    parsed.filters.sentiment = 'positive';
  } else if (lowerQuery.includes('negative') || lowerQuery.includes('bad') || lowerQuery.includes('hate')) {
    parsed.filters.sentiment = 'negative';
  }

  // Extract time filters
  if (lowerQuery.includes('recent') || lowerQuery.includes('latest')) {
    parsed.timeRange = '7d';
  } else if (lowerQuery.includes('last week')) {
    parsed.timeRange = '7d';
  } else if (lowerQuery.includes('last month')) {
    parsed.timeRange = '30d';
  }

  return parsed;
}

/**
 * Execute natural language query
 */
async function executeNaturalLanguageQuery(parsedQuery, productId) {
  let query = `
    SELECT 
      p.id,
      p.title,
      p.content,
      p.author,
      p.score,
      p.created_at,
      p.url,
      sa.sentiment_score,
      sa.sentiment_label,
      sa.keywords,
      pr.name as product_name,
      pl.name as platform_name
    FROM posts p
    LEFT JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
    LEFT JOIN products pr ON p.product_id = pr.id
    LEFT JOIN platforms pl ON p.platform_id = pl.id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 0;

  if (productId) {
    query += ` AND p.product_id = $${++paramCount}`;
    params.push(productId);
  }

  if (parsedQuery.filters.sentiment) {
    query += ` AND sa.sentiment_label = $${++paramCount}`;
    params.push(parsedQuery.filters.sentiment);
  }

  if (parsedQuery.timeRange) {
    const timeMap = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days'
    };
    query += ` AND p.created_at >= NOW() - INTERVAL '${timeMap[parsedQuery.timeRange]}'`;
  }

  query += ' ORDER BY p.score DESC, p.created_at DESC LIMIT 20';

  const result = await dbQuery(query, params);
  return result.rows;
}

/**
 * Perform advanced search with multiple filters
 */
async function performAdvancedSearch(filters, limit, sortBy) {
  let query = `
    SELECT 
      p.id,
      p.title,
      p.content,
      p.author,
      p.score,
      p.created_at,
      p.url,
      sa.sentiment_score,
      sa.sentiment_label,
      sa.keywords,
      pr.name as product_name,
      pl.name as platform_name
    FROM posts p
    LEFT JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
    LEFT JOIN products pr ON p.product_id = pr.id
    LEFT JOIN platforms pl ON p.platform_id = pl.id
    WHERE 1=1
  `;
  
  const params = [];
  let paramCount = 0;

  // Apply filters
  if (filters.productId) {
    query += ` AND p.product_id = $${++paramCount}`;
    params.push(filters.productId);
  }

  if (filters.platform) {
    query += ` AND pl.name = $${++paramCount}`;
    params.push(filters.platform);
  }

  if (filters.sentiment) {
    query += ` AND sa.sentiment_label = $${++paramCount}`;
    params.push(filters.sentiment);
  }

  if (filters.keywords && filters.keywords.length > 0) {
    const keywordConditions = filters.keywords.map(() => {
      paramCount++;
      return `(p.content ILIKE $${paramCount} OR sa.keywords::text ILIKE $${paramCount})`;
    });
    query += ` AND (${keywordConditions.join(' OR ')})`;
    filters.keywords.forEach(keyword => {
      params.push(`%${keyword}%`);
    });
  }

  if (filters.dateFrom) {
    query += ` AND p.created_at >= $${++paramCount}`;
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    query += ` AND p.created_at <= $${++paramCount}`;
    params.push(filters.dateTo);
  }

  if (filters.minScore) {
    query += ` AND p.score >= $${++paramCount}`;
    params.push(filters.minScore);
  }

  // Apply sorting
  switch (sortBy) {
    case 'date':
      query += ' ORDER BY p.created_at DESC';
      break;
    case 'score':
      query += ' ORDER BY p.score DESC';
      break;
    case 'sentiment':
      query += ' ORDER BY sa.sentiment_score DESC';
      break;
    default: // relevance
      query += ' ORDER BY p.score DESC, p.created_at DESC';
  }

  query += ` LIMIT $${++paramCount}`;
  params.push(limit);

  const result = await dbQuery(query, params);
  return result.rows;
}

/**
 * Get search suggestions based on existing content
 */
async function getSearchSuggestions(query, productId, limit) {
  let suggestionQuery = `
    SELECT DISTINCT keyword, COUNT(*) as frequency
    FROM posts p
    JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
    CROSS JOIN LATERAL unnest(sa.keywords) as keyword
    WHERE keyword ILIKE $1
  `;
  
  const params = [`%${query}%`];
  let paramCount = 1;

  if (productId) {
    suggestionQuery += ` AND p.product_id = $${++paramCount}`;
    params.push(productId);
  }

  suggestionQuery += `
    GROUP BY keyword
    ORDER BY frequency DESC, keyword ASC
    LIMIT $${++paramCount}
  `;
  params.push(limit);

  const result = await dbQuery(suggestionQuery, params);
  
  return result.rows.map(row => ({
    suggestion: row.keyword,
    frequency: parseInt(row.frequency)
  }));
}

module.exports = router;
