const { query: dbQuery } = require('../database/connection');
const logger = require('../utils/logger');
const { processContentEmbedding } = require('../services/vectorService');

/**
 * Generate insights for a product
 * @param {string} productId - Product ID
 * @param {string} platform - Platform filter
 * @param {string} timeframe - Time range filter
 * @returns {Array} Generated insights
 */
async function generateInsights(productId, platform, timeframe) {
  try {
    logger.info('Generating insights', { productId, platform, timeframe });

    // Get posts data for analysis
    const posts = await getPostsForAnalysis(productId, platform, timeframe);
    
    if (posts.length === 0) {
      logger.warn('No posts found for insight generation', { productId, platform, timeframe });
      return [];
    }

    // Analyze themes and patterns
    const themes = await analyzeThemes(posts);
    
    // Generate insights based on themes
    const insights = await createInsightsFromThemes(productId, themes);
    
    // Store insights in database
    await storeInsights(insights);

    logger.info('Insights generated successfully', { 
      productId, 
      insightCount: insights.length 
    });

    return insights;

  } catch (error) {
    logger.error('Failed to generate insights', { 
      error: error.message, 
      productId, 
      platform, 
      timeframe 
    });
    throw error;
  }
}

/**
 * Cluster themes from posts
 * @param {string} productId - Product ID
 * @param {string} platform - Platform filter
 * @param {string} timeframe - Time range filter
 * @param {number} minClusterSize - Minimum cluster size
 * @returns {Array} Clustered themes
 */
async function clusterThemes(productId, platform, timeframe, minClusterSize = 5) {
  try {
    logger.info('Clustering themes', { productId, platform, timeframe, minClusterSize });

    const posts = await getPostsForAnalysis(productId, platform, timeframe);
    
    if (posts.length === 0) {
      return [];
    }

    // Extract keywords and group by similarity
    const keywordGroups = await groupKeywordsBySimilarity(posts);
    
    // Filter groups by minimum size
    const clusters = keywordGroups
      .filter(group => group.posts.length >= minClusterSize)
      .map(group => ({
        theme: group.theme,
        keywords: group.keywords,
        postCount: group.posts.length,
        averageSentiment: group.averageSentiment,
        posts: group.posts.slice(0, 5), // Sample posts
        confidence: calculateClusterConfidence(group)
      }))
      .sort((a, b) => b.postCount - a.postCount);

    logger.info('Themes clustered successfully', { 
      productId, 
      clusterCount: clusters.length 
    });

    return clusters;

  } catch (error) {
    logger.error('Failed to cluster themes', { 
      error: error.message, 
      productId, 
      platform, 
      timeframe 
    });
    throw error;
  }
}

/**
 * Get posts for analysis
 */
async function getPostsForAnalysis(productId, platform, timeframe) {
  const timeMap = {
    '24h': '1 day',
    '7d': '7 days',
    '30d': '30 days',
    '90d': '90 days'
  };

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
      sa.confidence,
      pl.name as platform_name
    FROM posts p
    LEFT JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
    LEFT JOIN platforms pl ON p.platform_id = pl.id
    WHERE p.product_id = $1
  `;
  
  const params = [productId];
  let paramCount = 1;

  if (platform) {
    query += ` AND pl.name = $${++paramCount}`;
    params.push(platform);
  }

  if (timeframe !== 'all') {
    query += ` AND p.created_at >= NOW() - INTERVAL '${timeMap[timeframe]}'`;
  }

  query += ' ORDER BY p.created_at DESC LIMIT 1000';

  const result = await dbQuery(query, params);
  return result.rows;
}

/**
 * Analyze themes from posts
 */
async function analyzeThemes(posts) {
  const themes = new Map();

  for (const post of posts) {
    if (!post.keywords || post.keywords.length === 0) {
      continue;
    }

    for (const keyword of post.keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();
      
      if (!themes.has(normalizedKeyword)) {
        themes.set(normalizedKeyword, {
          keyword: normalizedKeyword,
          posts: [],
          sentimentScores: [],
          frequencies: []
        });
      }

      const theme = themes.get(normalizedKeyword);
      theme.posts.push({
        id: post.id,
        title: post.title,
        content: post.content.substring(0, 200),
        author: post.author,
        score: post.score,
        createdAt: post.created_at,
        sentimentScore: post.sentiment_score,
        sentimentLabel: post.sentiment_label,
        platform: post.platform_name
      });
      
      if (post.sentiment_score !== null) {
        theme.sentimentScores.push(post.sentiment_score);
      }
      
      theme.frequencies.push(1);
    }
  }

  // Calculate theme statistics
  const analyzedThemes = Array.from(themes.values()).map(theme => ({
    keyword: theme.keyword,
    postCount: theme.posts.length,
    averageSentiment: theme.sentimentScores.length > 0 
      ? theme.sentimentScores.reduce((sum, score) => sum + score, 0) / theme.sentimentScores.length 
      : 0,
    sentimentDistribution: calculateSentimentDistribution(theme.posts),
    posts: theme.posts.slice(0, 10), // Limit to 10 sample posts
    confidence: calculateThemeConfidence(theme)
  }));

  return analyzedThemes.sort((a, b) => b.postCount - a.postCount);
}

/**
 * Group keywords by similarity
 */
async function groupKeywordsBySimilarity(posts) {
  const keywordMap = new Map();

  // Collect all keywords with their posts
  for (const post of posts) {
    if (!post.keywords || post.keywords.length === 0) {
      continue;
    }

    for (const keyword of post.keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();
      
      if (!keywordMap.has(normalizedKeyword)) {
        keywordMap.set(normalizedKeyword, {
          keyword: normalizedKeyword,
          posts: [],
          sentimentScores: []
        });
      }

      keywordMap.get(normalizedKeyword).posts.push(post);
      if (post.sentiment_score !== null) {
        keywordMap.get(normalizedKeyword).sentimentScores.push(post.sentiment_score);
      }
    }
  }

  // Group similar keywords
  const groups = [];
  const processedKeywords = new Set();

  for (const [keyword, data] of keywordMap) {
    if (processedKeywords.has(keyword)) {
      continue;
    }

    const group = {
      theme: keyword,
      keywords: [keyword],
      posts: [...data.posts],
      sentimentScores: [...data.sentimentScores]
    };

    // Find similar keywords
    for (const [otherKeyword, otherData] of keywordMap) {
      if (processedKeywords.has(otherKeyword) || otherKeyword === keyword) {
        continue;
      }

      if (areKeywordsSimilar(keyword, otherKeyword)) {
        group.keywords.push(otherKeyword);
        group.posts.push(...otherData.posts);
        group.sentimentScores.push(...otherData.sentimentScores);
        processedKeywords.add(otherKeyword);
      }
    }

    processedKeywords.add(keyword);
    groups.push(group);
  }

  // Calculate group statistics
  return groups.map(group => ({
    theme: group.theme,
    keywords: group.keywords,
    posts: group.posts,
    averageSentiment: group.sentimentScores.length > 0 
      ? group.sentimentScores.reduce((sum, score) => sum + score, 0) / group.sentimentScores.length 
      : 0,
    postCount: group.posts.length
  }));
}

/**
 * Check if keywords are similar
 */
function areKeywordsSimilar(keyword1, keyword2) {
  // Simple similarity check - in production, use more sophisticated NLP
  const similarityThreshold = 0.7;
  
  // Check if one contains the other
  if (keyword1.includes(keyword2) || keyword2.includes(keyword1)) {
    return true;
  }

  // Check edit distance (simplified)
  const distance = levenshteinDistance(keyword1, keyword2);
  const maxLength = Math.max(keyword1.length, keyword2.length);
  const similarity = 1 - (distance / maxLength);
  
  return similarity >= similarityThreshold;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate sentiment distribution
 */
function calculateSentimentDistribution(posts) {
  const distribution = {
    positive: 0,
    negative: 0,
    neutral: 0
  };

  for (const post of posts) {
    if (post.sentimentLabel) {
      distribution[post.sentimentLabel]++;
    }
  }

  const total = posts.length;
  if (total > 0) {
    distribution.positive = (distribution.positive / total * 100).toFixed(1);
    distribution.negative = (distribution.negative / total * 100).toFixed(1);
    distribution.neutral = (distribution.neutral / total * 100).toFixed(1);
  }

  return distribution;
}

/**
 * Calculate theme confidence
 */
function calculateThemeConfidence(theme) {
  const postCount = theme.posts.length;
  const sentimentCount = theme.sentimentScores.length;
  
  // Confidence based on post count and sentiment data availability
  let confidence = Math.min(0.9, postCount / 20); // Max confidence at 20+ posts
  
  if (sentimentCount < postCount * 0.5) {
    confidence *= 0.7; // Reduce confidence if sentiment data is sparse
  }
  
  return Math.max(0.1, confidence);
}

/**
 * Calculate cluster confidence
 */
function calculateClusterConfidence(cluster) {
  const postCount = cluster.posts.length;
  const keywordCount = cluster.keywords.length;
  
  // Confidence based on cluster size and keyword diversity
  let confidence = Math.min(0.9, postCount / 15); // Max confidence at 15+ posts
  
  if (keywordCount > 1) {
    confidence *= 1.1; // Boost confidence for multi-keyword clusters
  }
  
  return Math.max(0.1, Math.min(0.95, confidence));
}

/**
 * Create insights from themes
 */
async function createInsightsFromThemes(productId, themes) {
  const insights = [];

  for (const theme of themes) {
    if (theme.postCount < 3) {
      continue; // Skip themes with too few posts
    }

    const insightType = determineInsightType(theme);
    const title = generateInsightTitle(theme, insightType);
    const description = generateInsightDescription(theme, insightType);

    insights.push({
      productId,
      insightType,
      title,
      description,
      sentimentSummary: {
        averageScore: theme.averageSentiment,
        distribution: theme.sentimentDistribution,
        postCount: theme.postCount
      },
      contentCount: theme.postCount,
      confidence: theme.confidence
    });
  }

  return insights;
}

/**
 * Determine insight type based on theme
 */
function determineInsightType(theme) {
  const avgSentiment = theme.averageSentiment;
  const postCount = theme.postCount;
  
  if (avgSentiment < -0.2 && postCount >= 5) {
    return 'complaint';
  } else if (avgSentiment > 0.2 && postCount >= 3) {
    return 'praise';
  } else if (postCount >= 10) {
    return 'trend';
  } else {
    return 'feature_request';
  }
}

/**
 * Generate insight title
 */
function generateInsightTitle(theme, insightType) {
  const keyword = theme.keyword;
  
  switch (insightType) {
    case 'complaint':
      return `Users reporting issues with ${keyword}`;
    case 'praise':
      return `Positive feedback about ${keyword}`;
    case 'trend':
      return `Growing discussion around ${keyword}`;
    case 'feature_request':
      return `Feature requests related to ${keyword}`;
    default:
      return `Insight about ${keyword}`;
  }
}

/**
 * Generate insight description
 */
function generateInsightDescription(theme, insightType) {
  const postCount = theme.postCount;
  const avgSentiment = theme.averageSentiment;
  const distribution = theme.sentimentDistribution;
  
  let description = `Found ${postCount} posts discussing this topic. `;
  
  if (insightType === 'complaint') {
    description += `Users are experiencing issues with an average sentiment score of ${avgSentiment.toFixed(2)}. `;
    description += `${distribution.negative}% of mentions are negative.`;
  } else if (insightType === 'praise') {
    description += `Users are expressing satisfaction with an average sentiment score of ${avgSentiment.toFixed(2)}. `;
    description += `${distribution.positive}% of mentions are positive.`;
  } else {
    description += `Average sentiment score is ${avgSentiment.toFixed(2)}. `;
    description += `Sentiment distribution: ${distribution.positive}% positive, ${distribution.negative}% negative, ${distribution.neutral}% neutral.`;
  }
  
  return description;
}

/**
 * Store insights in database
 */
async function storeInsights(insights) {
  for (const insight of insights) {
    try {
      await dbQuery(
        `INSERT INTO insights (product_id, insight_type, title, description, sentiment_summary, content_count, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (product_id, insight_type, title) DO UPDATE SET
         description = EXCLUDED.description,
         sentiment_summary = EXCLUDED.sentiment_summary,
         content_count = EXCLUDED.content_count,
         confidence = EXCLUDED.confidence,
         updated_at = CURRENT_TIMESTAMP`,
        [
          insight.productId,
          insight.insightType,
          insight.title,
          insight.description,
          JSON.stringify(insight.sentimentSummary),
          insight.contentCount,
          insight.confidence
        ]
      );
    } catch (error) {
      logger.error('Failed to store insight', { 
        error: error.message, 
        insight: insight.title 
      });
    }
  }
}

module.exports = {
  generateInsights,
  clusterThemes
};
