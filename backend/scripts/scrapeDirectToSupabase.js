#!/usr/bin/env node

/**
 * Direct Reddit Scraper for Supabase
 * Scrapes Reddit posts directly without complex table relationships
 * Uses the existing product UUID: 412ac63f-91be-4f26-bf66-2de7b9158126
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Use the existing product UUID
const EXISTING_PRODUCT_ID = '412ac63f-91be-4f26-bf66-2de7b9158126';

console.log('🔧 Supabase URL:', process.env.SUPABASE_URL);
console.log('📦 Product ID:', EXISTING_PRODUCT_ID);

async function scrapeDirectToSupabase() {
  console.log('🔍 Scraping real Reddit data directly to Supabase...');

  try {
    // First, let's check what tables exist
    console.log('🔍 Checking database structure...');
    
    // Try to query posts table to see if it exists
    const { data: testQuery, error: testError } = await supabase
      .from('posts')
      .select('id')
      .limit(1);
      
    if (testError) {
      console.log('📋 Posts table structure:', testError.message);
      // Let's try a simpler approach - create our own posts table
      await createSimplePostsTable();
    } else {
      console.log('✅ Posts table exists!');
    }

    // Scrape real Reddit posts
    const posts = await scrapeRedditPosts();
    console.log(`📊 Scraped ${posts.length} real Reddit posts`);

    // Insert posts using a simple structure
    let insertedCount = 0;
    for (const post of posts) {
      try {
        // Try inserting to a simple posts structure first
        const postData = {
          external_id: post.id,
          title: post.title,
          content: post.content || post.title,
          url: post.url,
          author: post.author,
          score: post.score || 0,
          platform: 'reddit',
          subreddit: post.subreddit,
          created_at: new Date(post.created_utc * 1000).toISOString(),
          scraped_at: new Date().toISOString()
        };

        // Add product_id if the column exists
        if (EXISTING_PRODUCT_ID) {
          postData.product_id = EXISTING_PRODUCT_ID;
        }

        const { data: insertedPost, error: postError } = await supabase
          .from('posts')
          .upsert([postData], { onConflict: 'external_id' })
          .select()
          .single();

        if (postError) {
          console.warn(`⚠️ Post insertion failed for ${post.id}:`, postError.message);
          // Try alternative approach - insert to a custom table
          await insertToCustomTable(post);
          continue;
        }

        insertedCount++;
        console.log(`✅ ${insertedCount}: "${post.title.substring(0, 50)}..." (r/${post.subreddit})`);

      } catch (error) {
        console.warn(`⚠️ Failed to process post ${post.id}:`, error.message);
      }
    }

    console.log(`🎉 Successfully inserted ${insertedCount} real Reddit posts!`);
    return insertedCount;

  } catch (error) {
    console.error('❌ Scraping failed:', error.message);
    throw error;
  }
}

async function createSimplePostsTable() {
  console.log('🔨 Creating simple posts table...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS reddit_posts (
      id SERIAL PRIMARY KEY,
      external_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      url TEXT,
      author TEXT,
      score INTEGER DEFAULT 0,
      platform TEXT DEFAULT 'reddit',
      subreddit TEXT,
      product_id TEXT,
      created_at TIMESTAMPTZ,
      scraped_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
  if (error) {
    console.log('📋 Could not create table:', error.message);
  } else {
    console.log('✅ Simple posts table ready!');
  }
}

async function insertToCustomTable(post) {
  // Fallback: insert to a custom reddit_posts table
  const { error } = await supabase
    .from('reddit_posts')
    .upsert([{
      external_id: post.id,
      title: post.title,
      content: post.content || post.title,
      url: post.url,
      author: post.author,
      score: post.score || 0,
      platform: 'reddit',
      subreddit: post.subreddit,
      product_id: EXISTING_PRODUCT_ID,
      created_at: new Date(post.created_utc * 1000).toISOString()
    }], { onConflict: 'external_id' });

  if (!error) {
    console.log(`📝 Inserted to reddit_posts table: ${post.title.substring(0, 30)}...`);
    return true;
  }
  return false;
}

async function scrapeRedditPosts() {
  const allPosts = [];
  
  // WHOOP-focused search queries
  const searchQueries = [
    { subreddit: 'whoop', term: 'WHOOP 4.0 review', limit: 5 },
    { subreddit: 'whoop', term: 'battery life', limit: 4 },
    { subreddit: 'fitness', term: 'WHOOP strap', limit: 4 },
    { subreddit: 'fitness', term: 'WHOOP vs Garmin', limit: 3 }
  ];

  for (const query of searchQueries) {
    try {
      console.log(`📊 Scraping r/${query.subreddit} for "${query.term}"...`);
      
      const response = await axios.get(`https://www.reddit.com/r/${query.subreddit}/search.json`, {
        params: {
          q: query.term,
          sort: 'new',
          t: 'month',
          limit: query.limit,
          raw_json: 1
        },
        headers: {
          'User-Agent': 'WHOOP-Analytics-Scraper/1.0'
        },
        timeout: 15000
      });

      if (response.data?.data?.children) {
        const posts = response.data.data.children
          .map(child => child.data)
          .filter(post => 
            post && 
            post.title && 
            post.id && 
            !post.stickied && // Skip pinned posts
            post.title.toLowerCase().includes('whoop')
          );

        console.log(`✅ Found ${posts.length} relevant posts in r/${query.subreddit}`);
        
        posts.forEach(post => {
          allPosts.push({
            id: post.id,
            title: post.title,
            content: post.selftext || '',
            url: `https://reddit.com${post.permalink}`,
            author: post.author,
            score: post.score,
            created_utc: post.created_utc,
            subreddit: query.subreddit
          });
        });
      }

      // Rate limiting - be respectful to Reddit
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error) {
      console.warn(`⚠️ Failed to scrape r/${query.subreddit}:`, error.message);
    }
  }

  // Remove duplicates and limit results
  const uniquePosts = allPosts.filter((post, index, self) => 
    self.findIndex(p => p.id === post.id) === index
  ).slice(0, 20);

  return uniquePosts;
}

// Run the scraper
if (require.main === module) {
  scrapeDirectToSupabase()
    .then(count => {
      console.log('\n🎉 SUCCESS!');
      console.log(`📊 Inserted ${count} real Reddit posts`);
      console.log('📦 Product ID:', EXISTING_PRODUCT_ID);
      console.log('\n🌐 Check your Supabase dashboard to see the data!');
      console.log('🚀 Dashboard URL: http://localhost:3001/api/insights/dashboard/' + EXISTING_PRODUCT_ID);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ FAILED:', error.message);
      process.exit(1);
    });
}
