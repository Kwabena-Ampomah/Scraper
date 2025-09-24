/**
 * Supabase Vector Database Service
 * 
 * Handles vector storage, indexing, and similarity search
 * using Supabase with pgvector extension
 */

const { createClient } = require('@supabase/supabase-js');
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

class SupabaseVectorService {
  constructor() {
    this.supabase = null;
    this.embeddingsTable = 'embeddings';
    this.batchSize = 100;
    this.rateLimitDelay = 500; // 500ms between batches
  }

  /**
   * Initialize Supabase client
   */
  async initialize() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Test connection and verify table structure
    try {
      await this.verifyTableStructure();
      logger.info('🔍 Supabase Vector Service initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Supabase Vector Service', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify embeddings table structure
   */
  async verifyTableStructure() {
    try {
      const { data, error } = await this.supabase
        .from(this.embeddingsTable)
        .select('*')
        .limit(1);

      if (error && !error.message.includes('relation "embeddings" does not exist')) {
        throw error;
      }

      logger.info('✅ Embeddings table verified');
    } catch (error) {
      logger.warn('⚠️ Embeddings table may not exist, will create during indexing');
    }
  }

  /**
   * Index embeddings in Supabase
   */
  async indexEmbeddings(embeddedData) {
    if (!this.supabase) {
      throw new Error('SupabaseVectorService not initialized. Call initialize() first.');
    }

    logger.info('🔍 Starting embeddings indexing...', { 
      itemCount: embeddedData.length 
    });

    const results = {
      indexed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Process in batches
    for (let i = 0; i < embeddedData.length; i += this.batchSize) {
      const batch = embeddedData.slice(i, i + this.batchSize);
      logger.info(`📊 Indexing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(embeddedData.length / this.batchSize)}`);

      try {
        const batchResults = await this.indexBatch(batch);
        results.indexed += batchResults.indexed;
        results.failed += batchResults.failed;
        results.skipped += batchResults.skipped;
        results.errors.push(...batchResults.errors);

        // Rate limiting between batches
        if (i + this.batchSize < embeddedData.length) {
          await this.delay(this.rateLimitDelay);
        }

      } catch (error) {
        logger.error(`❌ Batch indexing failed`, { 
          error: error.message,
          batchStart: i,
          batchSize: batch.length 
        });
        
        results.failed += batch.length;
        results.errors.push({
          batch: Math.floor(i / this.batchSize) + 1,
          error: error.message
        });
      }
    }

    logger.info(`✅ Embeddings indexing completed`, { 
      indexed: results.indexed,
      failed: results.failed,
      skipped: results.skipped,
      totalErrors: results.errors.length
    });

    return results;
  }

  /**
   * Index a batch of embeddings
   */
  async indexBatch(batch) {
    const results = {
      indexed: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Prepare batch data
    const batchData = batch
      .filter(item => item.embedding && item.embedding.length > 0)
      .map(item => ({
        content_id: item.id,
        content_type: 'post',
        content_text: item.cleanedText || '',
        embedding: item.embedding,
        metadata: {
          title: item.title || '',
          author: item.author || '',
          platform: item.platform || 'unknown',
          keywords: item.keywords || [],
          searchTerm: item.searchTerm || '',
          embeddingModel: item.embeddingModel || 'text-embedding-ada-002',
          embeddingTokens: item.embeddingTokens || 0,
          embeddingCost: item.embeddingCost || 0,
          features: item.features || {},
          entities: item.entities || {},
          processedAt: item.processedAt?.toISOString() || new Date().toISOString(),
          embeddedAt: item.embeddedAt?.toISOString() || new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

    results.skipped = batch.length - batchData.length;

    if (batchData.length === 0) {
      logger.warn('⚠️ No valid embeddings in batch to index');
      return results;
    }

    try {
      const { data, error } = await this.supabase
        .from(this.embeddingsTable)
        .upsert(batchData, {
          onConflict: 'content_id,content_type',
          ignoreDuplicates: false
        });

      if (error) {
        throw error;
      }

      results.indexed = batchData.length;
      logger.debug(`✅ Indexed ${batchData.length} embeddings in batch`);

    } catch (error) {
      logger.error('❌ Batch upsert failed', { 
        error: error.message,
        batchSize: batchData.length 
      });
      
      results.failed = batchData.length;
      results.errors.push({
        operation: 'upsert',
        error: error.message,
        batchSize: batchData.length
      });
    }

    return results;
  }

  /**
   * Perform similarity search
   */
  async similaritySearch(queryEmbedding, options = {}) {
    if (!this.supabase) {
      throw new Error('SupabaseVectorService not initialized');
    }

    const {
      limit = 10,
      threshold = 0.7,
      contentType = 'post',
      platform = null,
      subreddit = null
    } = options;

    logger.info('🔍 Performing similarity search...', { 
      limit, 
      threshold, 
      contentType 
    });

    try {
      // Build query
      let query = this.supabase
        .from(this.embeddingsTable)
        .select('*')
        .eq('content_type', contentType);

      // Add filters
      if (platform) {
        query = query.eq('metadata->platform', platform);
      }

      if (subreddit) {
        query = query.eq('metadata->subreddit', subreddit);
      }

      // Add similarity search using pgvector
      // Use RPC function to avoid URL length limits
      const { data, error } = await this.supabase.rpc('search_similar_embeddings', {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        content_type_filter: contentType
      });

      if (error) {
        throw error;
      }

      // Results already include similarity scores from the RPC function
      const results = data || [];

      logger.info(`✅ Similarity search completed`, { 
        found: results.length,
        requested: limit 
      });

      return results;

    } catch (error) {
      logger.error('❌ Similarity search failed', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  calculateCosineSimilarity(vector1, vector2) {
    if (!vector1 || !vector2) {
      return 0;
    }

    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return similarity;
  }

  /**
   * Calculate cosine distance between two vectors
   */
  calculateCosineDistance(vector1, vector2) {
    return 1 - this.calculateCosineSimilarity(vector1, vector2);
  }

  /**
   * Search by text query (requires embedding generation)
   */
  async searchByText(textQuery, options = {}) {
    logger.info('🔍 Performing text-based search...', { 
      query: textQuery.substring(0, 100) 
    });

    try {
      // Generate embedding for the query
      const EmbeddingsService = require('./embeddingsService');
      const embeddingsService = new EmbeddingsService();
      await embeddingsService.initialize();

      const queryEmbedding = await embeddingsService.generateQueryEmbedding(textQuery);

      // Perform similarity search
      const results = await this.similaritySearch(queryEmbedding.embedding, options);

      logger.info(`✅ Text search completed`, { 
        query: textQuery.substring(0, 50),
        results: results.length 
      });

      return results;

    } catch (error) {
      logger.error('❌ Text search failed', { 
        error: error.message,
        query: textQuery.substring(0, 100) 
      });
      throw error;
    }
  }

  /**
   * Get embeddings statistics
   */
  async getStats() {
    if (!this.supabase) {
      throw new Error('SupabaseVectorService not initialized');
    }

    try {
      const { count, error } = await this.supabase
        .from(this.embeddingsTable)
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return {
        totalEmbeddings: count || 0,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('❌ Failed to get stats', { error: error.message });
      return {
        totalEmbeddings: 0,
        lastUpdated: null,
        error: error.message
      };
    }
  }

  /**
   * Delete embeddings by content ID
   */
  async deleteEmbeddings(contentIds) {
    if (!this.supabase) {
      throw new Error('SupabaseVectorService not initialized');
    }

    logger.info('🗑️ Deleting embeddings...', { count: contentIds.length });

    try {
      const { error } = await this.supabase
        .from(this.embeddingsTable)
        .delete()
        .in('content_id', contentIds);

      if (error) {
        throw error;
      }

      logger.info(`✅ Deleted ${contentIds.length} embeddings`);

    } catch (error) {
      logger.error('❌ Failed to delete embeddings', { 
        error: error.message,
        count: contentIds.length 
      });
      throw error;
    }
  }

  /**
   * Update embedding metadata
   */
  async updateMetadata(contentId, contentType, metadata) {
    if (!this.supabase) {
      throw new Error('SupabaseVectorService not initialized');
    }

    try {
      const { error } = await this.supabase
        .from(this.embeddingsTable)
        .update({
          metadata: metadata,
          updated_at: new Date().toISOString()
        })
        .eq('content_id', contentId)
        .eq('content_type', contentType);

      if (error) {
        throw error;
      }

      logger.debug(`✅ Updated metadata for ${contentId}`);

    } catch (error) {
      logger.error('❌ Failed to update metadata', { 
        error: error.message,
        contentId 
      });
      throw error;
    }
  }

  /**
   * Utility function to add delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SupabaseVectorService;
