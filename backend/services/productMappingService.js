/**
 * Product-Subreddit Mapping Service
 * 
 * Handles mapping between products and their associated subreddits
 * Enables dynamic product_id assignment when scraping
 */

const { query: dbQuery } = require('../database/connection');
const logger = require('../utils/logger');

class ProductMappingService {
  
  /**
   * Get product ID by subreddit name
   */
  static async getProductIdBySubreddit(subreddit) {
    try {
      const result = await dbQuery(
        `SELECT id, name FROM products WHERE subreddit = $1 LIMIT 1`,
        [subreddit]
      );
      
      if (result.rows.length === 0) {
        logger.warn(`❌ No product found for subreddit: ${subreddit}`);
        return null;
      }
      
      const product = result.rows[0];
      logger.info(`✅ Found product mapping: ${subreddit} → ${product.name} (${product.id})`);
      return product.id;
    } catch (error) {
      logger.error('❌ Error getting product by subreddit:', { subreddit, error: error.message });
      return null;
    }
  }

  /**
   * Get all product-subreddit mappings
   */
  static async getAllMappings() {
    try {
      const result = await dbQuery(
        `SELECT p.id, p.name, p.version, p.subreddit, c.name as company_name
         FROM products p
         JOIN companies c ON p.company_id = c.id
         WHERE p.subreddit IS NOT NULL
         ORDER BY p.name`
      );
      
      return result.rows;
    } catch (error) {
      logger.error('❌ Error getting all mappings:', error.message);
      return [];
    }
  }

  /**
   * Add a new product-subreddit mapping
   */
  static async addMapping(companyName, productName, version, subreddit, description = '') {
    try {
      // Get or create company
      let companyResult = await dbQuery(
        `SELECT id FROM companies WHERE name = $1`,
        [companyName]
      );
      
      let companyId;
      if (companyResult.rows.length === 0) {
        const newCompany = await dbQuery(
          `INSERT INTO companies (name) VALUES ($1) RETURNING id`,
          [companyName]
        );
        companyId = newCompany.rows[0].id;
      } else {
        companyId = companyResult.rows[0].id;
      }

      // Create product with subreddit mapping
      const productResult = await dbQuery(
        `INSERT INTO products (company_id, name, version, description, subreddit) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (name, version) DO UPDATE SET 
           subreddit = EXCLUDED.subreddit,
           description = EXCLUDED.description
         RETURNING id`,
        [companyId, productName, version, description, subreddit]
      );
      
      const productId = productResult.rows[0].id;
      logger.info(`✅ Added mapping: ${subreddit} → ${productName} (${productId})`);
      return productId;
    } catch (error) {
      logger.error('❌ Error adding mapping:', error.message);
      throw error;
    }
  }

  /**
   * Save a Reddit post with automatic product mapping
   */
  static async saveRedditPost(post, platformId) {
    try {
      const productId = await this.getProductIdBySubreddit(post.subreddit);
      
      if (!productId) {
        logger.error(`❌ No product found for subreddit: ${post.subreddit}`);
        return null;
      }

      // Insert post
      const postResult = await dbQuery(
        `INSERT INTO posts (
          product_id, platform_id, external_id, title, content, 
          url, author, score, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (external_id, platform_id) DO UPDATE SET 
          updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [
          productId,
          platformId,
          post.id,
          post.title,
          post.content || post.title,
          post.url,
          post.author,
          post.score || 0,
          new Date()
        ]
      );

      const postDbId = postResult.rows[0].id;

      // Add sentiment analysis (demo data for now)
      const sentimentScore = (Math.random() - 0.5) * 2; // -1 to 1
      const sentimentLabel = sentimentScore > 0.1 ? 'positive' : sentimentScore < -0.1 ? 'negative' : 'neutral';

      await dbQuery(
        `INSERT INTO sentiment_analysis (
          content_id, content_type, sentiment_label, sentiment_score, 
          confidence, keywords, entities, created_at
        ) VALUES ($1, 'post', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (content_id, content_type) DO UPDATE SET 
          sentiment_score = EXCLUDED.sentiment_score,
          updated_at = CURRENT_TIMESTAMP`,
        [
          postDbId,
          sentimentLabel,
          sentimentScore,
          Math.random() * 0.3 + 0.7,
          JSON.stringify(['whoop', 'fitness', 'battery', 'sleep', 'tracker']),
          JSON.stringify([])
        ]
      );

      logger.info(`✅ Saved post: ${post.title.substring(0, 50)}... → ${productId}`);
      return postDbId;

    } catch (error) {
      logger.error(`❌ Error saving post: ${error.message}`);
      return null;
    }
  }
}

module.exports = ProductMappingService;
