// Vercel API function for insights dashboard - Updated
const { createClient } = require('@supabase/supabase-js');

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

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️ Supabase credentials not configured, returning mock data');
      // Return mock data if Supabase not configured
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

      return res.status(200).json({
        success: true,
        dashboard,
        productId,
        platform: 'all',
        timeframe: '30d',
        source: 'mock_data'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sentiment data from Supabase
    const { data: sentimentData, error: sentimentError } = await supabase
      .from('sentiment_analysis')
      .select(`
        sentiment_score,
        keywords,
        posts!inner(product_id)
      `)
      .eq('posts.product_id', productId);

    if (sentimentError) {
      console.error('Supabase error:', sentimentError);
      throw sentimentError;
    }

    // Calculate sentiment metrics
    const totalPosts = sentimentData?.length || 0;
    const averageSentiment = totalPosts > 0 
      ? sentimentData.reduce((sum, item) => sum + (item.sentiment_score || 0), 0) / totalPosts 
      : 0;
    
    const positiveCount = sentimentData?.filter(item => (item.sentiment_score || 0) > 0.1).length || 0;
    const negativeCount = sentimentData?.filter(item => (item.sentiment_score || 0) < -0.1).length || 0;
    const neutralCount = totalPosts - positiveCount - negativeCount;

    // Extract keywords
    const keywordMap = {};
    sentimentData?.forEach(item => {
      if (item.keywords && Array.isArray(item.keywords)) {
        item.keywords.forEach(keyword => {
          if (!keywordMap[keyword]) {
            keywordMap[keyword] = { frequency: 0, totalSentiment: 0 };
          }
          keywordMap[keyword].frequency++;
          keywordMap[keyword].totalSentiment += item.sentiment_score || 0;
        });
      }
    });

    const topKeywords = Object.entries(keywordMap)
      .map(([keyword, data]) => ({
        keyword,
        frequency: data.frequency,
        averageSentiment: data.totalSentiment / data.frequency
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    const dashboard = {
      sentiment: {
        totalPosts,
        averageSentiment,
        positiveCount,
        negativeCount,
        neutralCount,
        positivePercentage: totalPosts > 0 ? ((positiveCount / totalPosts) * 100).toFixed(1) : '0.0',
        negativePercentage: totalPosts > 0 ? ((negativeCount / totalPosts) * 100).toFixed(1) : '0.0',
        neutralPercentage: totalPosts > 0 ? ((neutralCount / totalPosts) * 100).toFixed(1) : '0.0'
      },
      topKeywords,
      platformBreakdown: [{
        platform: 'reddit',
        postCount: totalPosts,
        averageSentiment
      }],
      trends: []
    };

    res.status(200).json({
      success: true,
      dashboard,
      productId,
      platform: 'all',
      timeframe: '30d',
      source: 'supabase_database'
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}