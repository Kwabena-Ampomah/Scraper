// Vercel API function for insights dashboard
const { Pool } = require('pg');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { productId } = req.query;
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // Connect to database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.DB_URL
    });

    // Get sentiment data
    const sentimentQuery = `
      SELECT 
        COUNT(*) as total_posts,
        AVG(sa.sentiment_score) as average_sentiment,
        COUNT(CASE WHEN sa.sentiment_score > 0.1 THEN 1 END) as positive_count,
        COUNT(CASE WHEN sa.sentiment_score < -0.1 THEN 1 END) as negative_count,
        COUNT(CASE WHEN sa.sentiment_score BETWEEN -0.1 AND 0.1 THEN 1 END) as neutral_count
      FROM posts p
      LEFT JOIN sentiment_analysis sa ON p.id = sa.content_id
      WHERE p.product_id = $1
    `;

    const sentimentResult = await pool.query(sentimentQuery, [productId]);
    const sentiment = sentimentResult.rows[0];

    // Get keywords
    const keywordsQuery = `
      SELECT 
        unnest(sa.keywords) as keyword,
        COUNT(*) as frequency,
        AVG(sa.sentiment_score) as average_sentiment
      FROM posts p
      LEFT JOIN sentiment_analysis sa ON p.id = sa.content_id
      WHERE p.product_id = $1 AND sa.keywords IS NOT NULL
      GROUP BY keyword
      ORDER BY frequency DESC
      LIMIT 10
    `;

    const keywordsResult = await pool.query(keywordsQuery, [productId]);

    // Calculate percentages
    const total = parseInt(sentiment.total_posts) || 0;
    const positiveCount = parseInt(sentiment.positive_count) || 0;
    const negativeCount = parseInt(sentiment.negative_count) || 0;
    const neutralCount = parseInt(sentiment.neutral_count) || 0;

    const dashboard = {
      sentiment: {
        totalPosts: total,
        averageSentiment: parseFloat(sentiment.average_sentiment) || 0,
        positiveCount: positiveCount,
        negativeCount: negativeCount,
        neutralCount: neutralCount,
        positivePercentage: total > 0 ? ((positiveCount / total) * 100).toFixed(1) : '0.0',
        negativePercentage: total > 0 ? ((negativeCount / total) * 100).toFixed(1) : '0.0',
        neutralPercentage: total > 0 ? ((neutralCount / total) * 100).toFixed(1) : '0.0'
      },
      topKeywords: keywordsResult.rows.map(row => ({
        keyword: row.keyword,
        frequency: parseInt(row.frequency),
        averageSentiment: parseFloat(row.average_sentiment) || 0
      })),
      platformBreakdown: [{
        platform: 'reddit',
        postCount: total,
        averageSentiment: parseFloat(sentiment.average_sentiment) || 0
      }],
      trends: [] // Could be implemented with time-based queries
    };

    await pool.end();

    res.status(200).json({
      success: true,
      dashboard,
      productId,
      platform: 'all',
      timeframe: '30d'
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
