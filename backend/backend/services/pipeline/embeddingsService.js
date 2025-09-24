/**
 * OpenAI Embeddings Service
 * 
 * Handles text embedding generation using OpenAI API
 * Includes batching, rate limiting, and error handling
 */

const OpenAI = require('openai');
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

class EmbeddingsService {
  constructor() {
    this.openai = null;
    this.model = 'text-embedding-ada-002';
    this.maxTokens = 8192;
    this.maxChars = 6000; // Conservative estimate for token limit
    this.batchSize = 100; // OpenAI batch limit
    this.rateLimitDelay = 1000; // 1 second between requests
    this.retryAttempts = 3;
    this.retryDelay = 2000; // 2 seconds
  }

  /**
   * Initialize OpenAI client
   */
  async initialize() {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not provided - embeddings service will be disabled');
      this.openai = null;
      return;
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Test connection
    try {
      await this.openai.models.list();
      logger.info('🤖 OpenAI client initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize OpenAI client', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate embeddings for processed text data
   */
  async generateEmbeddings(processedData) {
    if (!this.openai) {
      throw new Error('EmbeddingsService not initialized. Call initialize() first.');
    }

    logger.info('🤖 Starting embeddings generation...', { 
      itemCount: processedData.length 
    });

    const embeddedData = [];

    // Process in batches
    for (let i = 0; i < processedData.length; i += this.batchSize) {
      const batch = processedData.slice(i, i + this.batchSize);
      logger.info(`📊 Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(processedData.length / this.batchSize)}`);

      try {
        const batchResults = await this.processBatch(batch);
        embeddedData.push(...batchResults);

        // Rate limiting between batches
        if (i + this.batchSize < processedData.length) {
          await this.delay(this.rateLimitDelay);
        }

      } catch (error) {
        logger.error(`❌ Batch processing failed`, { 
          error: error.message,
          batchStart: i,
          batchSize: batch.length 
        });
        
        // Add fallback items for failed batch
        const fallbackItems = batch.map(item => this.createFallbackItem(item));
        embeddedData.push(...fallbackItems);
      }
    }

    logger.info(`✅ Embeddings generation completed`, { 
      total: embeddedData.length,
      successful: embeddedData.filter(item => item.embedding).length,
      failed: embeddedData.filter(item => !item.embedding).length
    });

    return embeddedData;
  }

  /**
   * Process a batch of items
   */
  async processBatch(batch) {
    const results = [];

    for (const item of batch) {
      try {
        const embeddedItem = await this.generateSingleEmbedding(item);
        results.push(embeddedItem);

      } catch (error) {
        logger.error(`❌ Failed to generate embedding for item`, { 
          error: error.message,
          itemId: item.id,
          title: item.title?.substring(0, 50)
        });
        
        results.push(this.createFallbackItem(item));
      }
    }

    return results;
  }

  /**
   * Generate embedding for a single item
   */
  async generateSingleEmbedding(item) {
    // Prepare text for embedding
    const textToEmbed = this.prepareTextForEmbedding(item.cleanedText);
    
    if (!textToEmbed || textToEmbed.length === 0) {
      throw new Error('No text content to embed');
    }

    // Generate embedding with retry logic
    let lastError;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: textToEmbed,
        });

        const embedding = response.data[0].embedding;
        const usage = response.usage;

        return {
          ...item,
          embedding,
          embeddingModel: this.model,
          embeddingTokens: usage.total_tokens,
          embeddingPromptTokens: usage.prompt_tokens,
          embeddingCost: this.calculateCost(usage.total_tokens),
          embeddedAt: new Date(),
          embeddingMetadata: {
            textLength: textToEmbed.length,
            truncated: item.cleanedText.length > this.maxChars,
            attempt: attempt
          }
        };

      } catch (error) {
        lastError = error;
        logger.warn(`⚠️ Embedding attempt ${attempt} failed`, { 
          error: error.message,
          itemId: item.id,
          attempt 
        });

        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Prepare text for embedding
   */
  prepareTextForEmbedding(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Truncate text to fit token limits
    let preparedText = text.substring(0, this.maxChars);

    // Clean up any incomplete words at the end
    const lastSpaceIndex = preparedText.lastIndexOf(' ');
    if (lastSpaceIndex > this.maxChars * 0.9) {
      preparedText = preparedText.substring(0, lastSpaceIndex);
    }

    return preparedText.trim();
  }

  /**
   * Calculate embedding cost (approximate)
   */
  calculateCost(tokens) {
    // text-embedding-ada-002 pricing: $0.0001 per 1K tokens
    return (tokens / 1000) * 0.0001;
  }

  /**
   * Create fallback item when embedding fails
   */
  createFallbackItem(item) {
    return {
      ...item,
      embedding: null,
      embeddingModel: this.model,
      embeddingTokens: 0,
      embeddingPromptTokens: 0,
      embeddingCost: 0,
      embeddedAt: new Date(),
      embeddingMetadata: {
        textLength: item.cleanedText?.length || 0,
        truncated: false,
        error: 'Embedding generation failed'
      }
    };
  }

  /**
   * Generate embeddings for search queries
   */
  async generateQueryEmbedding(query) {
    if (!this.openai) {
      throw new Error('EmbeddingsService not initialized');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: query,
      });

      return {
        embedding: response.data[0].embedding,
        model: this.model,
        tokens: response.usage.total_tokens,
        cost: this.calculateCost(response.usage.total_tokens)
      };

    } catch (error) {
      logger.error('❌ Query embedding generation failed', { 
        error: error.message,
        query: query.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * Batch generate embeddings for multiple queries
   */
  async generateQueryEmbeddings(queries) {
    logger.info('🔍 Generating query embeddings...', { 
      queryCount: queries.length 
    });

    const results = [];

    for (const query of queries) {
      try {
        const result = await this.generateQueryEmbedding(query);
        results.push({
          query,
          ...result
        });

        // Rate limiting
        await this.delay(this.rateLimitDelay);

      } catch (error) {
        logger.error('❌ Query embedding failed', { 
          error: error.message,
          query: query.substring(0, 100)
        });
        
        results.push({
          query,
          embedding: null,
          error: error.message
        });
      }
    }

    logger.info(`✅ Query embeddings completed`, { 
      total: results.length,
      successful: results.filter(r => r.embedding).length
    });

    return results;
  }

  /**
   * Calculate similarity between two embeddings
   */
  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) {
      return 0;
    }

    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return similarity;
  }

  /**
   * Find most similar items using embeddings
   */
  findSimilarItems(queryEmbedding, itemEmbeddings, topK = 10) {
    const similarities = itemEmbeddings.map(item => ({
      ...item,
      similarity: this.calculateSimilarity(queryEmbedding, item.embedding)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Get embedding statistics
   */
  getStats(embeddedData) {
    const stats = {
      total: embeddedData.length,
      successful: embeddedData.filter(item => item.embedding).length,
      failed: embeddedData.filter(item => !item.embedding).length,
      totalTokens: embeddedData.reduce((sum, item) => sum + (item.embeddingTokens || 0), 0),
      totalCost: embeddedData.reduce((sum, item) => sum + (item.embeddingCost || 0), 0),
      avgTokensPerItem: 0,
      avgCostPerItem: 0
    };

    if (stats.successful > 0) {
      stats.avgTokensPerItem = stats.totalTokens / stats.successful;
      stats.avgCostPerItem = stats.totalCost / stats.successful;
    }

    return stats;
  }

  /**
   * Utility function to add delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = EmbeddingsService;
