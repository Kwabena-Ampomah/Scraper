/**
 * Text Cleaning and Preprocessing Service
 * 
 * Handles text normalization, cleaning, and preprocessing
 * for Reddit posts and comments before storage and analysis
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class TextCleaner {
  constructor() {
    this.stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'among', 'this', 'that', 'these',
      'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
      'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'be', 'am', 'is', 'are',
      'was', 'were', 'been', 'being', 'a', 'an', 'some', 'any', 'all',
      'every', 'each', 'much', 'many', 'more', 'most', 'less', 'few',
      'little', 'big', 'small', 'good', 'bad', 'new', 'old', 'first',
      'last', 'next', 'other', 'same', 'different', 'own', 'get', 'got',
      'make', 'made', 'take', 'took', 'come', 'came', 'go', 'went',
      'see', 'saw', 'know', 'knew', 'think', 'thought', 'say', 'said',
      'tell', 'told', 'give', 'gave', 'find', 'found', 'feel', 'felt'
    ]);

    this.redditPatterns = {
      // Remove Reddit-specific formatting
      userMentions: /u\/\w+/g,
      subredditMentions: /r\/\w+/g,
      // Remove markdown formatting
      bold: /\*\*(.*?)\*\*/g,
      italic: /\*(.*?)\*/g,
      strikethrough: /~~(.*?)~~/g,
      code: /`(.*?)`/g,
      // Remove URLs
      urls: /https?:\/\/[^\s]+/g,
      // Remove special Reddit formatting
      spoiler: />!(.*?)!/g,
      quote: /^>\s*/gm
    };
  }

  /**
   * Clean and preprocess text data
   */
  async cleanTextData(rawData) {
    logger.info('🧹 Starting text cleaning process...', { 
      itemCount: rawData.length 
    });

    const processedData = rawData.map((item, index) => {
      try {
        const cleanedItem = this.cleanItem(item);
        
        if (index % 10 === 0) {
          logger.debug(`📊 Processed ${index + 1}/${rawData.length} items`);
        }
        
        return cleanedItem;
      } catch (error) {
        logger.error(`❌ Failed to clean item ${index}`, { 
          error: error.message,
          itemId: item.id 
        });
        return this.createFallbackItem(item);
      }
    });

    logger.info(`✅ Text cleaning completed`, { 
      processed: processedData.length,
      original: rawData.length 
    });

    return processedData;
  }

  /**
   * Clean a single item
   */
  cleanItem(item) {
    // Combine title and content
    const fullText = `${item.title || ''} ${item.content || ''}`.trim();
    
    // Clean the text
    const cleanedText = this.cleanText(fullText);
    
    // Extract features
    const features = this.extractFeatures(cleanedText, item);
    
    // Extract keywords
    const keywords = this.extractKeywords(cleanedText);
    
    // Extract entities (simple approach)
    const entities = this.extractEntities(cleanedText);

    return {
      ...item,
      originalText: fullText,
      cleanedText,
      textLength: cleanedText.length,
      wordCount: cleanedText.split(/\s+/).length,
      keywords,
      entities,
      features,
      processedAt: new Date(),
      cleaningMetadata: {
        originalLength: fullText.length,
        cleaningRatio: cleanedText.length / Math.max(fullText.length, 1),
        hasUrls: this.redditPatterns.urls.test(fullText),
        hasMentions: this.redditPatterns.userMentions.test(fullText)
      }
    };
  }

  /**
   * Clean raw text
   */
  cleanText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let cleaned = text;

    // Remove Reddit-specific formatting
    Object.values(this.redditPatterns).forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });

    // Remove extra whitespace and normalize
    cleaned = cleaned
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n+/g, ' ') // Newlines to spaces
      .replace(/\t+/g, ' ') // Tabs to spaces
      .trim();

    // Remove special characters but keep punctuation
    cleaned = cleaned.replace(/[^\w\s.,!?;:'"()-]/g, ' ');

    // Final cleanup
    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  /**
   * Extract keywords from cleaned text
   */
  extractKeywords(text) {
    if (!text) return [];

    const words = text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2) // Minimum word length
      .filter(word => !this.stopWords.has(word)) // Remove stop words
      .filter(word => /^[a-zA-Z]+$/.test(word)); // Only alphabetic words

    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Return top keywords by frequency
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15) // Top 15 keywords
      .map(([word, count]) => ({ word, count }));
  }

  /**
   * Extract entities (simple approach)
   */
  extractEntities(text) {
    if (!text) return [];

    const entities = {
      products: [],
      features: [],
      emotions: [],
      numbers: []
    };

    // Extract product mentions (simple patterns)
    const productPatterns = [
      /whoop\s+\d+\.?\d*/gi,
      /apple\s+watch/gi,
      /fitbit/gi,
      /garmin/gi,
      /samsung\s+galaxy\s+watch/gi
    ];

    productPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        entities.products.push(...matches.map(m => m.toLowerCase()));
      }
    });

    // Extract feature mentions
    const featurePatterns = [
      /heart\s+rate/gi,
      /sleep\s+tracking/gi,
      /strain\s+score/gi,
      /recovery/gi,
      /battery\s+life/gi,
      /water\s+resistance/gi,
      /gps/gi,
      /bluetooth/gi
    ];

    featurePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        entities.features.push(...matches.map(m => m.toLowerCase()));
      }
    });

    // Extract emotional words
    const emotionWords = [
      'love', 'hate', 'amazing', 'terrible', 'awesome', 'awful',
      'great', 'bad', 'good', 'excellent', 'horrible', 'fantastic',
      'disappointed', 'excited', 'frustrated', 'happy', 'sad',
      'angry', 'pleased', 'annoyed', 'impressed', 'disgusted'
    ];

    emotionWords.forEach(emotion => {
      if (text.toLowerCase().includes(emotion)) {
        entities.emotions.push(emotion);
      }
    });

    // Extract numbers
    const numberMatches = text.match(/\d+/g);
    if (numberMatches) {
      entities.numbers = numberMatches.slice(0, 10); // Limit to 10 numbers
    }

    return entities;
  }

  /**
   * Extract text features
   */
  extractFeatures(text, item) {
    const features = {
      // Text statistics
      characterCount: text.length,
      wordCount: text.split(/\s+/).length,
      sentenceCount: text.split(/[.!?]+/).length,
      
      // Content indicators
      hasQuestions: /\?/.test(text),
      hasExclamations: /!/.test(text),
      hasNumbers: /\d/.test(text),
      hasCapitals: /[A-Z]/.test(text),
      
      // Reddit-specific features
      score: item.score || 0,
      commentCount: item.commentCount || 0,
      upvoteRatio: item.upvoteRatio || 0,
      
      // Temporal features
      createdAt: item.createdAt,
      ageInDays: item.createdAt ? 
        Math.floor((Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      
      // Platform features
      platform: item.platform || 'unknown',
      subreddit: item.subreddit || 'unknown'
    };

    // Calculate readability score (simple Flesch-like)
    features.readabilityScore = this.calculateReadabilityScore(text);

    return features;
  }

  /**
   * Calculate simple readability score
   */
  calculateReadabilityScore(text) {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const syllables = this.estimateSyllables(text);

    if (words === 0 || sentences === 0) return 0;

    const avgWordsPerSentence = words / sentences;
    const avgSyllablesPerWord = syllables / words;

    // Simple readability formula
    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Estimate syllables in text
   */
  estimateSyllables(text) {
    const words = text.toLowerCase().split(/\s+/);
    let syllables = 0;

    words.forEach(word => {
      if (word.length <= 3) {
        syllables += 1;
      } else {
        // Simple syllable estimation
        const vowels = word.match(/[aeiouy]+/g);
        syllables += vowels ? vowels.length : 1;
      }
    });

    return syllables;
  }

  /**
   * Create fallback item when cleaning fails
   */
  createFallbackItem(item) {
    return {
      ...item,
      originalText: `${item.title || ''} ${item.content || ''}`.trim(),
      cleanedText: `${item.title || ''} ${item.content || ''}`.trim(),
      textLength: `${item.title || ''} ${item.content || ''}`.trim().length,
      wordCount: 0,
      keywords: [],
      entities: { products: [], features: [], emotions: [], numbers: [] },
      features: {
        characterCount: 0,
        wordCount: 0,
        sentenceCount: 0,
        hasQuestions: false,
        hasExclamations: false,
        hasNumbers: false,
        hasCapitals: false,
        score: item.score || 0,
        commentCount: item.commentCount || 0,
        upvoteRatio: item.upvoteRatio || 0,
        createdAt: item.createdAt,
        ageInDays: 0,
        platform: item.platform || 'unknown',
        subreddit: item.subreddit || 'unknown',
        readabilityScore: 0
      },
      processedAt: new Date(),
      cleaningMetadata: {
        originalLength: 0,
        cleaningRatio: 1,
        hasUrls: false,
        hasMentions: false,
        error: 'Cleaning failed, using fallback'
      }
    };
  }

  /**
   * Batch process large datasets
   */
  async batchProcess(rawData, batchSize = 100) {
    logger.info('🔄 Starting batch text processing...', { 
      totalItems: rawData.length,
      batchSize 
    });

    const results = [];
    
    for (let i = 0; i < rawData.length; i += batchSize) {
      const batch = rawData.slice(i, i + batchSize);
      logger.info(`📊 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rawData.length / batchSize)}`);
      
      const batchResults = await this.cleanTextData(batch);
      results.push(...batchResults);
      
      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < rawData.length) {
        await this.delay(100);
      }
    }

    logger.info('✅ Batch processing completed', { 
      processed: results.length 
    });

    return results;
  }

  /**
   * Utility function to add delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TextCleaner;
