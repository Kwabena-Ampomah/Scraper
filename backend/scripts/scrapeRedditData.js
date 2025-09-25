#!/usr/bin/env node

/**
 * Reddit Data Scraper for existing reddit_data table
 * Scrapes real Reddit posts and inserts them into the reddit_data table
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log('🔧 Starting Reddit scraper...');

// Reddit API configuration
const REDDIT_BASE_URL = 'https://www.reddit.com';
const USER_AGENT = process.env.REDDIT_USER_AGENT || 'UserFeedbackIntelligence/1.0';

// Search terms for different types of content
const SEARCH_QUERIES = [
  // Pain points
  { query: 'whoop battery problem', subreddit: 'whoop', type: 'pain' },
  { query: 'whoop not working issue', subreddit: 'whoop', type: 'pain' },
  { query: 'whoop charging problem', subreddit: 'whoop', type: 'pain' },
  { query: 'whoop strap broken', subreddit: 'whoop', type: 'pain' },
  
  // Feature requests
  { query: 'whoop feature request', subreddit: 'whoop', type: 'feature' },
  { query: 'whoop should add', subreddit: 'whoop', type: 'feature' },
  { query: 'whoop need feature', subreddit: 'whoop', type: 'feature' },
  { query: 'whoop wish list', subreddit: 'whoop', type: 'feature' },
  
  // General feedback
  { query: 'whoop review', subreddit: 'fitness', type: 'general' },
  { query: 'whoop vs garmin', subreddit: 'fitness', type: 'general' },
  { query: 'whoop experience', subreddit: 'whoop', type: 'general' },
];

async function scrapeRedditPosts(query, subreddit) {
  try {
    console.log(`🔍 Searching r/${subreddit} for: "${query}"`);
    
    const url = `${REDDIT_BASE_URL}/r/${subreddit}/search.json`;
    const response = await axios.get(url, {
      params: {
        q: query,
        restrict_sr: 1,
        sort: 'relevance',
        t: 'month', // Last month
        limit: 25
      },
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    const posts = response.data?.data?.children || [];
    console.log(`✅ Found ${posts.length} posts for "${query}"`);
    
    return posts.map(post => ({
      reddit_id: post.data.id,
      title: post.data.title,
      content: post.data.selftext || '',
      author: post.data.author,
      score: post.data.score,
      subreddit: post.data.subreddit,
      url: `https://reddit.com${post.data.permalink}`,
      created_at: new Date(post.data.created_utc * 1000).toISOString()
    }));

  } catch (error) {
    console.error(`❌ Error scraping r/${subreddit} for "${query}":`, error.message);
    return [];
  }
}

async function insertPosts(posts) {
  if (posts.length === 0) return;

  try {
    // Check for existing posts to avoid duplicates
    const existingIds = await supabase
      .from('reddit_data')
      .select('reddit_id');
    
    const existingRedditIds = existingIds.data?.map(p => p.reddit_id) || [];
    
    // Filter out duplicates
    const newPosts = posts.filter(post => !existingRedditIds.includes(post.reddit_id));
    
    if (newPosts.length === 0) {
      console.log('⚠️ No new posts to insert (all already exist)');
      return;
    }

    console.log(`📝 Inserting ${newPosts.length} new posts...`);
    
    const { data, error } = await supabase
      .from('reddit_data')
      .insert(newPosts);

    if (error) {
      console.error('❌ Error inserting posts:', error.message);
    } else {
      console.log(`✅ Successfully inserted ${newPosts.length} posts!`);
    }

  } catch (error) {
    console.error('❌ Error in insertPosts:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting Reddit data scraping...');
  
  let totalPosts = 0;
  
  for (const searchQuery of SEARCH_QUERIES) {
    // Add delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const posts = await scrapeRedditPosts(searchQuery.query, searchQuery.subreddit);
    await insertPosts(posts);
    totalPosts += posts.length;
  }
  
  console.log(`\n🎉 Scraping complete!`);
  console.log(`📊 Total posts scraped: ${totalPosts}`);
  
  // Show current data count
  const { data: allPosts, error } = await supabase
    .from('reddit_data')
    .select('id', { count: 'exact' });
    
  if (!error) {
    console.log(`📦 Total posts in database: ${allPosts.length}`);
  }
}

if (require.main === module) {
  main().then(() => {
    console.log('✅ Done!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}
