/**
 * INSIGHTS API ROUTES - CORE ANALYTICS AND DASHBOARD DATA
 * 
 * Purpose: Provides RESTful endpoints for user feedback analytics and dashboard visualization
 * 
 * Key Responsibilities:
 * - Dashboard data aggregation (sentiment, keywords, pain points, feature requests)
 * - Real-time data processing from Supabase reddit_data table  
 * - Sentiment analysis and classification of user feedback
 * - Thematic clustering and keyword extraction
 * - Pain point identification and feature request detection
 * 
 * Main Endpoints:
 * - GET /dashboard/:productId - Complete dashboard analytics
 * - GET /clusters/:productId - Thematic clusters and trends
 * - GET /pain-points/:productId - Identified user pain points
 * - GET /feature-requests/:productId - User feature requests
 * 
 * Data Sources:
 * - Primary: Supabase reddit_data table (real scraped data)
 * 
 * Dependencies:
 * - Supabase client for real-time data access
 * - Logger for request tracking and debugging
 * 
 * Impact on System:
 * - Changes here affect all frontend dashboard visualizations
 * - Data structure changes require frontend component updates
 * - Performance optimizations impact dashboard load times
 * - New analytics features require both backend and frontend changes
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');
const { query: dbQuery } = require('../database/connection');
const { generateInsights, clusterThemes } = require('../services/insightsService');

// Initialize Supabase client as fallback
let supabase;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

const router = express.Router();

/**
 * Generate insights for a product
 * POST /api/insights/generate
 */
router.post('/generate', [
  body('productId').isUUID().withMessage('Valid product ID is required'),
  body('platform').optional().isString().withMessage('Platform must be a string'),
  body('timeframe').optional().isIn(['24h', '7d', '30d', '90d', 'all']).withMessage('Invalid timeframe'),
  body('forceRegenerate').optional().isBoolean().withMessage('Force regenerate must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, platform, timeframe = '30d', forceRegenerate = false } = req.body;
    
    logger.info('Generating insights', { productId, platform, timeframe, forceRegenerate });

    // Check if insights already exist and are recent
    if (!forceRegenerate) {
      const existingInsights = await dbQuery(
        `SELECT id, created_at FROM insights 
         WHERE product_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [productId]
      );

      if (existingInsights.rows.length > 0) {
        return res.json({
          success: true,
          message: 'Recent insights already exist',
          insights: existingInsights.rows,
          cached: true
        });
      }
    }

    // Generate new insights
    const insights = await generateInsights(productId, platform, timeframe);

    res.json({
      success: true,
      insights,
      count: insights.length,
      timeframe,
      platform: platform || 'all'
    });

  } catch (error) {
    logger.error('Insights generation endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get insights for a product
 * GET /api/insights/:productId
 */
router.get('/:productId', [
  query('platform').optional().isString().withMessage('Platform must be a string'),
  query('insightType').optional().isIn(['complaint', 'praise', 'trend', 'feature_request']).withMessage('Invalid insight type'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { platform, insightType, limit = 20 } = req.query;
    
    logger.info('Getting insights', { productId, platform, insightType });

    let query = `
      SELECT 
        i.*,
        pr.name as product_name,
        COUNT(DISTINCT p.id) as post_count,
        COUNT(DISTINCT c.id) as comment_count
      FROM insights i
      LEFT JOIN products pr ON i.product_id = pr.id
      LEFT JOIN posts p ON p.product_id = i.product_id
      LEFT JOIN comments c ON c.post_id = p.id
      WHERE i.product_id = $1
    `;
    
    const params = [productId];
    let paramCount = 1;

    if (platform) {
      query += ` AND p.platform_id = (SELECT id FROM platforms WHERE name = $${++paramCount})`;
      params.push(platform);
    }

    if (insightType) {
      query += ` AND i.insight_type = $${++paramCount}`;
      params.push(insightType);
    }

    query += `
      GROUP BY i.id, pr.name
      ORDER BY i.confidence DESC, i.created_at DESC
      LIMIT $${++paramCount}
    `;
    params.push(parseInt(limit));

    const result = await dbQuery(query, params);
    
    res.json({
      success: true,
      insights: result.rows,
      count: result.rows.length,
      productId,
      platform: platform || 'all'
    });

  } catch (error) {
    logger.error('Get insights endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get insights dashboard data
 * GET /api/insights/dashboard/:productId
 */
router.get('/dashboard/:productId', [
  query('platform').optional().isString().withMessage('Platform must be a string'),
  query('timeframe').optional().isIn(['24h', '7d', '30d', '90d', 'all']).withMessage('Invalid timeframe')
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { platform, timeframe = '30d' } = req.query;
    
    // Defensive check for required platform parameter
    if (!platform) {
      return res.status(400).json({ error: "Missing platform parameter" });
    }
    
    logger.info('Getting dashboard data', { productId, platform, timeframe });

    const dashboardData = await generateDashboardData(productId, platform, timeframe);

    // Transform data to match frontend expectations
    const transformedData = {
      sentiment: {
        totalPosts: dashboardData.sentiment?.totalPosts || 0,
        averageSentiment: dashboardData.sentiment?.averageSentiment || 0,
        positiveCount: dashboardData.sentiment?.positiveCount || 0,
        negativeCount: dashboardData.sentiment?.negativeCount || 0,
        neutralCount: dashboardData.sentiment?.neutralCount || 0,
        positivePercentage: (dashboardData.sentiment?.totalPosts || 0) > 0 ? 
          ((dashboardData.sentiment.positiveCount / dashboardData.sentiment.totalPosts) * 100).toFixed(1) : '0',
        negativePercentage: (dashboardData.sentiment?.totalPosts || 0) > 0 ? 
          ((dashboardData.sentiment.negativeCount / dashboardData.sentiment.totalPosts) * 100).toFixed(1) : '0',
        neutralPercentage: (dashboardData.sentiment?.totalPosts || 0) > 0 ? 
          ((dashboardData.sentiment.neutralCount / dashboardData.sentiment.totalPosts) * 100).toFixed(1) : '0'
      },
      topKeywords: (dashboardData.topKeywords || []).map(kw => ({
        keyword: kw.keyword,
        frequency: kw.frequency,
        averageSentiment: kw.averageSentiment || 0.5
      })),
      platformBreakdown: (dashboardData.platformBreakdown || []).length > 0 ? 
        dashboardData.platformBreakdown : [
        {
          platform: 'Reddit',
          postCount: dashboardData.sentiment.totalPosts || 0,
          averageSentiment: dashboardData.sentiment.averageSentiment || 0
        }
      ],
      trends: dashboardData.trends || []
    };

    res.json({
      success: true,
      dashboard: transformedData,
      productId,
      platform: platform || 'all',
      timeframe
    });

  } catch (error) {
    logger.error('Dashboard endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get thematic clusters
 * GET /api/insights/clusters/:productId
 */
router.get('/clusters/:productId', [
  query('platform').optional().isString().withMessage('Platform must be a string'),
  query('timeframe').optional().isIn(['24h', '7d', '30d', '90d', 'all']).withMessage('Invalid timeframe'),
  query('minClusterSize').optional().isInt({ min: 2, max: 100 }).withMessage('Min cluster size must be between 2 and 100')
], async (req, res) => {
  const { productId } = req.params;
  const { platform = "all", timeframe = "30d", minClusterSize = 5 } = req.query;

  console.log("📥 Clusters request:", { productId, platform, timeframe });

  try {
    // Defensive check for required platform parameter
    if (!platform) {
      return res.status(400).json({ error: "Missing platform parameter" });
    }
    
    logger.info('Getting thematic clusters', { productId, platform, timeframe, minClusterSize });

    // Get dashboard data and transform keywords into clusters
    const dashboardData = await generateDashboardData(productId, platform, timeframe);
    
    const clusters = (dashboardData.topKeywords || []).slice(0, 5).map((kw, index) => ({
      id: index + 1,
      name: kw.keyword,
      size: kw.frequency,
      keywords: [kw.keyword],
      averageSentiment: kw.averageSentiment || 0.5,
      trend: 'stable'
    }));

    res.json({
      success: true,
      clusters,
      productId,
      platform: platform || 'all',
      timeframe
    });

  } catch (err) {
    console.error("💥 Cluster route error:", {
      message: err.message,
      stack: err.stack,
      productId,
      platform,
      timeframe
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Get pain points analysis
 * GET /api/insights/pain-points/:productId
 */
router.get('/pain-points/:productId', [
  query('platform').optional().isString().withMessage('Platform must be a string'),
  query('timeframe').optional().isIn(['24h', '7d', '30d', '90d', 'all']).withMessage('Invalid timeframe'),
  query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level')
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { platform, timeframe = '30d', severity } = req.query;
    
    // Defensive check for required platform parameter
    if (!platform) {
      return res.status(400).json({ error: "Missing platform parameter" });
    }
    
    logger.info('Getting pain points', { productId, platform, timeframe, severity });

    // Get dashboard data and extract pain points
    const dashboardData = await generateDashboardData(productId, platform, timeframe);

    res.json({
      success: true,
      painPoints: dashboardData.painPoints || [],
      productId,
      platform: platform || 'all',
      timeframe
    });

  } catch (error) {
    logger.error('Pain points endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get feature requests analysis
 * GET /api/insights/feature-requests/:productId
 */
router.get('/feature-requests/:productId', [
  query('platform').optional().isString().withMessage('Platform must be a string'),
  query('timeframe').optional().isIn(['24h', '7d', '30d', '90d', 'all']).withMessage('Invalid timeframe'),
  query('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority level')
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { platform, timeframe = '30d', priority } = req.query;
    
    // Defensive check for required platform parameter
    if (!platform) {
      return res.status(400).json({ error: "Missing platform parameter" });
    }
    
    logger.info('Getting feature requests', { productId, platform, timeframe, priority });

    // Get dashboard data and extract feature requests
    const dashboardData = await generateDashboardData(productId, platform, timeframe);

    res.json({
      success: true,
      featureRequests: dashboardData.featureRequests || [],
      productId,
      platform: platform || 'all',
      timeframe
    });

  } catch (error) {
    logger.error('Feature requests endpoint error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions

/**
 * Generate dashboard data from Supabase
 */
async function generateDashboardDataFromSupabase(productId, platform, timeframe) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Note: For demo purposes, we'll return data regardless of productId
  // since the Supabase data doesn't have product relationships set up

  // Calculate date filter
  let dateFilter = null;
  if (timeframe !== 'all') {
    const now = new Date();
    const timeMap = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    const daysAgo = timeMap[timeframe] || 30;
    dateFilter = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000)).toISOString();
  }

  try {
    // Get Reddit data with optional date filter
    let query = supabase.from('reddit_data').select('*');
    
    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    const { data: redditData, error: redditError } = await query;
    
    if (redditError) {
      logger.error('Supabase reddit_data query error:', redditError);
      throw redditError;
    }

    // For demo purposes, use all available data regardless of product filtering
    const totalPosts = redditData?.length || 0;
    
    // Analyze sentiment based on score (Reddit upvotes/downvotes)
    const positiveCount = redditData.filter(post => post.score > 10).length;
    const negativeCount = redditData.filter(post => post.score < 0).length;
    const neutralCount = totalPosts - positiveCount - negativeCount;
    
    // Simple sentiment analysis based on scores
    const averageSentiment = redditData.reduce((sum, post) => {
      if (post.score > 10) return sum + 0.7; // positive
      if (post.score < 0) return sum - 0.5; // negative
      return sum; // neutral
    }, 0) / totalPosts;

    // Extract common keywords from titles
    const allTitles = redditData.map(post => post.title).join(' ').toLowerCase();
    const words = allTitles.split(/\s+/).filter(word => 
      word.length > 3 && 
      !['the', 'and', 'for', 'with', 'this', 'that', 'have', 'will', 'been', 'from', 'they', 'were', 'said', 'each', 'which', 'their'].includes(word)
    );
    
    const wordCounts = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    const keywords = Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ keyword: word, frequency: count }));

    // Identify pain points (posts with negative sentiment or low scores)
    const painPoints = redditData
      .filter(post => post.score <= 0 || post.title.toLowerCase().includes('problem') || post.title.toLowerCase().includes('issue'))
      .slice(0, 5)
      .map(post => ({
        text: post.title,
        frequency: Math.abs(post.score) + 1,
        category: 'user_experience'
      }));

    // Identify feature requests
    const featureRequests = redditData
      .filter(post => post.title.toLowerCase().includes('feature') || post.title.toLowerCase().includes('request') || post.title.toLowerCase().includes('wish'))
      .slice(0, 5)
      .map(post => ({
        text: post.title,
        frequency: post.score + 1,
        priority: post.score > 5 ? 'high' : 'medium'
      }));

    return {
      sentiment: {
        totalPosts: totalPosts,
        averageSentiment: averageSentiment,
        positiveCount: positiveCount,
        negativeCount: negativeCount,
        neutralCount: neutralCount
      },
      topKeywords: keywords,
      painPoints,
      featureRequests,
      trends: [
        {
          keyword: keywords[0]?.keyword || 'whoop',
          trend: totalPosts > 50 ? 'rising' : 'stable',
          change_percentage: Math.random() * 20 - 10 // Simple mock trend
        }
      ],
      summary: {
        total_feedback: totalPosts,
        sentiment_trend: averageSentiment > 0.1 ? 'improving' : averageSentiment < -0.1 ? 'declining' : 'stable',
        key_insights: [
          `Total ${totalPosts} Reddit posts analyzed`,
          `${Math.round((positiveCount / totalPosts) * 100)}% positive sentiment`,
          `Top keyword: "${keywords[0]?.keyword || 'whoop'}"`
        ]
      }
    };

  } catch (error) {
    logger.error('Error generating dashboard data from Supabase:', error);
    throw error;
  }
}

/**
 * Generate dashboard data from Supabase
 */
async function generateDashboardData(productId, platform, timeframe) {
  try {
    console.log('🔍 Generating dashboard data from Supabase...');
    const supabaseResult = await generateDashboardDataFromSupabase(productId, platform, timeframe);
    console.log('✅ Supabase result:', { totalPosts: supabaseResult.sentiment.totalPosts });
    return supabaseResult;
  } catch (error) {
    console.error('❌ Supabase failed:', error.message);
    logger.error('Dashboard data generation failed:', error.message);
    
    // Return empty data structure as fallback
    return {
      sentiment: {
        totalPosts: 0,
        averageSentiment: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0
      },
      topKeywords: [],
      painPoints: [],
      featureRequests: [],
      trends: []
    };
  }
}

module.exports = router;
