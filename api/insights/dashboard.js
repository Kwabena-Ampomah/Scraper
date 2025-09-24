// Vercel API function for insights dashboard
const { Pool } = require('pg');

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const productId = req.query.productId || req.url.split('/').pop().split('?')[0];
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Product ID is required'
      });
    }

    // For Vercel deployment, we'll return mock data since database isn't configured
    const dashboard = {
      sentiment: {
        totalPosts: 2,
        averageSentiment: 0.25,
        positiveCount: 2,
        negativeCount: 0,
        neutralCount: 0,
        positivePercentage: '100.0',
        negativePercentage: '0.0',
        neutralPercentage: '0.0'
      },
      topKeywords: [
        { keyword: 'everyone', frequency: 1, averageSentiment: 0.25 },
        { keyword: 'whoop 5.0', frequency: 1, averageSentiment: 0.25 },
        { keyword: 'monthly subscription', frequency: 1, averageSentiment: 0.25 }
      ],
      platformBreakdown: [{
        platform: 'reddit',
        postCount: 2,
        averageSentiment: 0.25
      }],
      trends: []
    };

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
}