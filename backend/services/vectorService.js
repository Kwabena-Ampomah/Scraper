const OpenAI = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Pinecone
let pinecone = null;
if (process.env.PINECONE_API_KEY && process.env.PINECONE_ENVIRONMENT) {
  pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT
  });
}

// Initialize Supabase
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

/**
 * Generate embedding for text using OpenAI
 * @param {string} text - Text to embed
 * @returns {Array} Embedding vector
 */
async function generateEmbedding(text) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.substring(0, 8000) // Limit text length
    });

    return response.data[0].embedding;

  } catch (error) {
    logger.error('Failed to generate embedding', { error: error.message, text: text.substring(0, 100) });
    throw error;
  }
}

/**
 * Store embedding in vector database
 * @param {string} contentId - Content ID
 * @param {string} contentType - Content type (post/comment)
 * @param {Array} embedding - Embedding vector
 * @param {Object} metadata - Additional metadata
 */
async function storeEmbedding(contentId, contentType, embedding, metadata = {}) {
  try {
    if (pinecone) {
      await storeInPinecone(contentId, contentType, embedding, metadata);
    } else if (supabase) {
      await storeInSupabase(contentId, contentType, embedding, metadata);
    } else {
      // Fallback to PostgreSQL with pgvector extension
      await storeInPostgreSQL(contentId, contentType, embedding, metadata);
    }

    logger.info('Embedding stored successfully', { contentId, contentType });

  } catch (error) {
    logger.error('Failed to store embedding', { error: error.message, contentId });
    throw error;
  }
}

/**
 * Store embedding in Pinecone
 */
async function storeInPinecone(contentId, contentType, embedding, metadata) {
  const index = pinecone.index('feedback-intelligence');
  
  await index.upsert([{
    id: `${contentType}_${contentId}`,
    values: embedding,
    metadata: {
      contentId,
      contentType,
      ...metadata
    }
  }]);
}

/**
 * Store embedding in Supabase
 */
async function storeInSupabase(contentId, contentType, embedding, metadata) {
  const { error } = await supabase
    .from('embeddings')
    .upsert({
      content_id: contentId,
      content_type: contentType,
      embedding: embedding,
      metadata: metadata
    });

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
}

/**
 * Store embedding in PostgreSQL (requires pgvector extension)
 */
async function storeInPostgreSQL(contentId, contentType, embedding, metadata) {
  const { query } = require('../database/connection');
  
  await query(
    `INSERT INTO embeddings (content_id, content_type, embedding, metadata)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (content_id, content_type) DO UPDATE SET
     embedding = EXCLUDED.embedding,
     metadata = EXCLUDED.metadata,
     created_at = CURRENT_TIMESTAMP`,
    [contentId, contentType, JSON.stringify(embedding), JSON.stringify(metadata)]
  );
}

/**
 * Search for similar content using vector similarity
 * @param {Object} options - Search options
 * @returns {Array} Similar content results
 */
async function searchSimilarContent(options) {
  try {
    const { embedding, productId, platform, limit = 20, threshold = 0.7 } = options;

    if (pinecone) {
      return await searchInPinecone(embedding, productId, platform, limit, threshold);
    } else if (supabase) {
      return await searchInSupabase(embedding, productId, platform, limit, threshold);
    } else {
      return await searchInPostgreSQL(embedding, productId, platform, limit, threshold);
    }

  } catch (error) {
    logger.error('Vector search failed', { error: error.message });
    throw error;
  }
}

/**
 * Search in Pinecone
 */
async function searchInPinecone(embedding, productId, platform, limit, threshold) {
  const index = pinecone.index('feedback-intelligence');
  
  const searchResponse = await index.query({
    vector: embedding,
    topK: limit,
    includeMetadata: true,
    filter: {
      ...(productId && { productId }),
      ...(platform && { platform })
    }
  });

  return searchResponse.matches
    .filter(match => match.score >= threshold)
    .map(match => ({
      id: match.metadata.contentId,
      contentType: match.metadata.contentType,
      score: match.score,
      metadata: match.metadata
    }));
}

/**
 * Search in Supabase
 */
async function searchInSupabase(embedding, productId, platform, limit, threshold) {
  let query = supabase
    .from('embeddings')
    .select('content_id, content_type, metadata')
    .order('embedding', { ascending: false })
    .limit(limit);

  if (productId) {
    query = query.eq('metadata->productId', productId);
  }

  if (platform) {
    query = query.eq('metadata->platform', platform);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Supabase search error: ${error.message}`);
  }

  return data.map(item => ({
    id: item.content_id,
    contentType: item.content_type,
    metadata: item.metadata
  }));
}

/**
 * Search in PostgreSQL using pgvector
 */
async function searchInPostgreSQL(embedding, productId, platform, limit, threshold) {
  const { query } = require('../database/connection');
  
  let searchQuery = `
    SELECT 
      e.content_id,
      e.content_type,
      e.metadata,
      1 - (e.embedding <=> $1) as similarity_score,
      p.title,
      p.content,
      p.author,
      p.score,
      p.created_at,
      p.url,
      sa.sentiment_score,
      sa.sentiment_label,
      pr.name as product_name,
      pl.name as platform_name
    FROM embeddings e
    LEFT JOIN posts p ON e.content_id = p.id AND e.content_type = 'post'
    LEFT JOIN comments c ON e.content_id = c.id AND e.content_type = 'comment'
    LEFT JOIN sentiment_analysis sa ON e.content_id = sa.content_id AND e.content_type = sa.content_type
    LEFT JOIN products pr ON p.product_id = pr.id
    LEFT JOIN platforms pl ON p.platform_id = pl.id
    WHERE 1 - (e.embedding <=> $1) >= $2
  `;
  
  const params = [JSON.stringify(embedding), threshold];
  let paramCount = 2;

  if (productId) {
    searchQuery += ` AND (p.product_id = $${++paramCount} OR c.post_id IN (SELECT id FROM posts WHERE product_id = $${paramCount}))`;
    params.push(productId);
  }

  if (platform) {
    searchQuery += ` AND pl.name = $${++paramCount}`;
    params.push(platform);
  }

  searchQuery += ` ORDER BY similarity_score DESC LIMIT $${++paramCount}`;
  params.push(limit);

  const result = await query(searchQuery, params);
  
  return result.rows.map(row => ({
    id: row.content_id,
    contentType: row.content_type,
    score: parseFloat(row.similarity_score),
    metadata: row.metadata,
    content: {
      title: row.title,
      content: row.content,
      author: row.author,
      score: row.score,
      createdAt: row.created_at,
      url: row.url,
      sentimentScore: row.sentiment_score,
      sentimentLabel: row.sentiment_label,
      productName: row.product_name,
      platformName: row.platform_name
    }
  }));
}

/**
 * Batch generate embeddings for multiple texts
 * @param {Array} texts - Array of texts to embed
 * @returns {Array} Array of embeddings
 */
async function batchGenerateEmbeddings(texts) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: texts.map(text => text.substring(0, 8000))
    });

    return response.data.map(item => item.embedding);

  } catch (error) {
    logger.error('Batch embedding generation failed', { error: error.message, count: texts.length });
    throw error;
  }
}

/**
 * Process and store embeddings for new content
 * @param {string} contentId - Content ID
 * @param {string} contentType - Content type
 * @param {string} text - Text content
 * @param {Object} metadata - Additional metadata
 */
async function processContentEmbedding(contentId, contentType, text, metadata = {}) {
  try {
    // Generate embedding
    const embedding = await generateEmbedding(text);
    
    // Store embedding
    await storeEmbedding(contentId, contentType, embedding, metadata);
    
    logger.info('Content embedding processed', { contentId, contentType });

  } catch (error) {
    logger.error('Content embedding processing failed', { 
      error: error.message, 
      contentId, 
      contentType 
    });
    throw error;
  }
}

/**
 * Initialize vector database indexes
 */
async function initializeVectorDatabase() {
  try {
    if (pinecone) {
      // Check if index exists, create if not
      const indexList = await pinecone.listIndexes();
      const indexExists = indexList.indexes.some(index => index.name === 'feedback-intelligence');
      
      if (!indexExists) {
        await pinecone.createIndex({
          name: 'feedback-intelligence',
          dimension: 1536, // OpenAI ada-002 dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });
        
        logger.info('Pinecone index created: feedback-intelligence');
      }
    }

    logger.info('Vector database initialized successfully');

  } catch (error) {
    logger.error('Vector database initialization failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  generateEmbedding,
  storeEmbedding,
  searchSimilarContent,
  batchGenerateEmbeddings,
  processContentEmbedding,
  initializeVectorDatabase
};
