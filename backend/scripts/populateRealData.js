const { pool } = require('../database/connection');
const redditScraper = require('../backend/services/pipeline/redditScraper');

async function populateRealData() {
  console.log('🚀 Starting real data population...');
  
  try {
    // Check if product exists
    const productResult = await pool.query(
      'SELECT id FROM products WHERE id = $1',
      ['412ac63f-91be-4f26-bf66-2de7b9158126']
    );
    
    if (productResult.rows.length === 0) {
      console.log('❌ Product not found! Creating WHOOP product...');
      await pool.query(`
        INSERT INTO products (id, name, subreddit, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, ['412ac63f-91be-4f26-bf66-2de7b9158126', 'WHOOP 5.0', 'whoop']);
      console.log('✅ WHOOP product created!');
    }
    
    // Scrape Reddit data for WHOOP
    console.log('📡 Scraping Reddit for WHOOP posts...');
    const searchTerms = ['WHOOP 5.0', 'WHOOP band', 'WHOOP fitness tracker', 'WHOOP review'];
    const subreddits = ['whoop', 'fitness', 'fitnesstracker', 'biohacking', 'quantifiedself'];
    
    let totalPosts = 0;
    
    for (const subreddit of subreddits) {
      console.log(`🔍 Searching r/${subreddit}...`);
      
      for (const term of searchTerms) {
        try {
          const posts = await redditScraper.searchReddit({
            searchTerms: [term],
            subreddits: [subreddit],
            maxPosts: 10,
            productId: '412ac63f-91be-4f26-bf66-2de7b9158126'
          });
          
          console.log(`📝 Found ${posts.length} posts for "${term}" in r/${subreddit}`);
          totalPosts += posts.length;
        } catch (error) {
          console.warn(`⚠️ Error searching "${term}" in r/${subreddit}:`, error.message);
        }
      }
    }
    
    console.log(`🎉 Successfully populated ${totalPosts} posts!`);
    
    // Check final count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM reddit_posts WHERE product_id = $1',
      ['412ac63f-91be-4f26-bf66-2de7b9158126']
    );
    
    console.log(`📊 Total posts in database: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error populating data:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  populateRealData();
}

module.exports = populateRealData;
