const Sentiment = require('sentiment');
const natural = require('natural');
const nlp = require('compromise');
const logger = require('../utils/logger');

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Custom sentiment dictionary for product feedback
const customSentimentDictionary = {
  // Positive words
  'love': 3, 'amazing': 3, 'excellent': 3, 'perfect': 3, 'fantastic': 3,
  'great': 2, 'good': 2, 'awesome': 3, 'brilliant': 3, 'outstanding': 3,
  'impressive': 2, 'satisfied': 2, 'happy': 2, 'pleased': 2, 'recommend': 2,
  'works well': 2, 'easy to use': 2, 'user friendly': 2, 'intuitive': 2,
  'reliable': 2, 'fast': 2, 'smooth': 2, 'responsive': 2, 'stable': 2,
  
  // Negative words
  'hate': -3, 'terrible': -3, 'awful': -3, 'horrible': -3, 'disgusting': -3,
  'bad': -2, 'poor': -2, 'disappointed': -2, 'frustrated': -2, 'annoying': -2,
  'broken': -2, 'buggy': -2, 'slow': -2, 'crashes': -2, 'unreliable': -2,
  'confusing': -2, 'difficult': -2, 'complicated': -2, 'useless': -2,
  'waste': -2, 'regret': -2, 'return': -2, 'refund': -2, 'complaint': -2,
  
  // Product-specific terms
  'battery life': 0, 'screen': 0, 'camera': 0, 'performance': 0,
  'design': 0, 'price': 0, 'quality': 0, 'features': 0, 'update': 0
};

// Add custom dictionary to sentiment analyzer
sentiment.registerLanguage('en', {
  labels: customSentimentDictionary,
  scoring: customSentimentDictionary
});

/**
 * Analyze sentiment of text content
 * @param {string} text - Text to analyze
 * @returns {Object} Sentiment analysis result
 */
async function analyzeSentiment(text) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input');
    }

    // Clean and preprocess text
    const cleanedText = preprocessText(text);
    
    // Basic sentiment analysis
    const sentimentResult = sentiment.analyze(cleanedText);
    
    // Enhanced analysis with NLP
    const enhancedAnalysis = await enhancedSentimentAnalysis(cleanedText);
    
    // Extract keywords
    const keywords = extractKeywords(cleanedText);
    
    // Determine sentiment label
    const sentimentLabel = determineSentimentLabel(sentimentResult.score, enhancedAnalysis.confidence);
    
    return {
      score: normalizeScore(sentimentResult.score),
      label: sentimentLabel,
      confidence: enhancedAnalysis.confidence,
      keywords: keywords,
      emotions: enhancedAnalysis.emotions,
      analysis: {
        positive: sentimentResult.positive,
        negative: sentimentResult.negative,
        comparative: sentimentResult.comparative
      }
    };

  } catch (error) {
    logger.error('Sentiment analysis failed', { error: error.message, text: text.substring(0, 100) });
    
    // Return neutral sentiment as fallback
    return {
      score: 0,
      label: 'neutral',
      confidence: 0.5,
      keywords: [],
      emotions: {},
      analysis: { positive: [], negative: [], comparative: 0 }
    };
  }
}

/**
 * Enhanced sentiment analysis using NLP techniques
 * @param {string} text - Preprocessed text
 * @returns {Object} Enhanced analysis result
 */
async function enhancedSentimentAnalysis(text) {
  try {
    const doc = nlp(text);
    
    // Extract emotions
    const emotions = {
      joy: doc.match('#Joy').length,
      anger: doc.match('#Anger').length,
      fear: doc.match('#Fear').length,
      sadness: doc.match('#Sadness').length,
      surprise: doc.match('#Surprise').length
    };
    
    // Calculate confidence based on emotion intensity
    const totalEmotions = Object.values(emotions).reduce((sum, count) => sum + count, 0);
    const confidence = Math.min(0.9, 0.5 + (totalEmotions * 0.1));
    
    // Detect sarcasm (simple heuristic)
    const sarcasmIndicators = ['yeah right', 'sure', 'whatever', 'great', 'perfect'];
    const hasSarcasm = sarcasmIndicators.some(indicator => 
      text.toLowerCase().includes(indicator)
    );
    
    return {
      emotions,
      confidence: hasSarcasm ? confidence * 0.7 : confidence,
      sarcasm: hasSarcasm
    };

  } catch (error) {
    logger.warn('Enhanced sentiment analysis failed', { error: error.message });
    return {
      emotions: {},
      confidence: 0.5,
      sarcasm: false
    };
  }
}

/**
 * Extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {Array} Array of keywords
 */
function extractKeywords(text) {
  try {
    const doc = nlp(text);
    
    // Extract nouns and adjectives
    const nouns = doc.nouns().out('array');
    const adjectives = doc.adjectives().out('array');
    
    // Combine and filter
    const keywords = [...nouns, ...adjectives]
      .filter(word => word.length > 2) // Filter short words
      .filter(word => !isStopWord(word)) // Remove stop words
      .slice(0, 10); // Limit to 10 keywords
    
    return keywords;

  } catch (error) {
    logger.warn('Keyword extraction failed', { error: error.message });
    return [];
  }
}

/**
 * Preprocess text for analysis
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function preprocessText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Determine sentiment label based on score and confidence
 * @param {number} score - Sentiment score
 * @param {number} confidence - Confidence level
 * @returns {string} Sentiment label
 */
function determineSentimentLabel(score, confidence) {
  if (confidence < 0.3) {
    return 'neutral';
  }
  
  if (score > 0.1) {
    return 'positive';
  } else if (score < -0.1) {
    return 'negative';
  } else {
    return 'neutral';
  }
}

/**
 * Normalize sentiment score to -1 to 1 range
 * @param {number} score - Raw sentiment score
 * @returns {number} Normalized score
 */
function normalizeScore(score) {
  // Normalize to -1 to 1 range
  return Math.max(-1, Math.min(1, score / 10));
}

/**
 * Check if word is a stop word
 * @param {string} word - Word to check
 * @returns {boolean} True if stop word
 */
function isStopWord(word) {
  const stopWords = [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
  ];
  
  return stopWords.includes(word.toLowerCase());
}

/**
 * Batch analyze multiple texts
 * @param {Array} texts - Array of texts to analyze
 * @returns {Array} Array of sentiment analysis results
 */
async function batchAnalyzeSentiment(texts) {
  try {
    const results = await Promise.all(
      texts.map(text => analyzeSentiment(text))
    );
    
    return results;

  } catch (error) {
    logger.error('Batch sentiment analysis failed', { error: error.message });
    throw error;
  }
}

/**
 * Get sentiment statistics for a product
 * @param {string} productId - Product ID
 * @returns {Object} Sentiment statistics
 */
async function getSentimentStatistics(productId) {
  try {
    const { query } = require('../database/connection');
    
    const result = await query(`
      SELECT 
        COUNT(*) as total_posts,
        AVG(sentiment_score) as average_score,
        COUNT(CASE WHEN sentiment_label = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_count,
        COUNT(CASE WHEN sentiment_label = 'neutral' THEN 1 END) as neutral_count
      FROM posts p
      JOIN sentiment_analysis sa ON p.id = sa.content_id AND sa.content_type = 'post'
      WHERE p.product_id = $1
    `, [productId]);
    
    const stats = result.rows[0];
    
    return {
      totalPosts: parseInt(stats.total_posts),
      averageScore: parseFloat(stats.average_score || 0),
      positiveCount: parseInt(stats.positive_count),
      negativeCount: parseInt(stats.negative_count),
      neutralCount: parseInt(stats.neutral_count),
      positivePercentage: stats.total_posts > 0 ? 
        (stats.positive_count / stats.total_posts * 100).toFixed(1) : 0,
      negativePercentage: stats.total_posts > 0 ? 
        (stats.negative_count / stats.total_posts * 100).toFixed(1) : 0
    };

  } catch (error) {
    logger.error('Failed to get sentiment statistics', { error: error.message, productId });
    throw error;
  }
}

module.exports = {
  analyzeSentiment,
  batchAnalyzeSentiment,
  getSentimentStatistics
};
