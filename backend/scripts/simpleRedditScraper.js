#!/usr/bin/env node

/**
 * Ultra Simple Reddit Scraper
 * Creates its own table and inserts real Reddit data
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log('🔧 Supabase URL:', process.env.SUPABASE_URL);

async function scrapeAndStore() {
  console.log('🔍 Starting Reddit data scraping...');

  try {
    // Step 1: Create our table
    await createRedditTable();
    
    // Step 2: Scrape Reddit
    const posts = await scrapeRedditPosts();
    console.log(`📊 Found ${posts.length} real Reddit posts`);

    // Step 3: Insert data
    let inserted = 0;
    for (const post of posts) {
      const success = await insertPost(post);
      if (success) inserted++;
    }

    console.log(`🎉 Successfully stored ${inserted} Reddit posts!`);
    
    // Step 4: Verify data
    await showStoredData();
    
    return inserted;

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

async function createRedditTable() {
  console.log('🔨 Setting up reddit_data table...');
  
  // Use raw SQL to create table
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS reddit_data (
        id SERIAL PRIMARY KEY,
        reddit_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        author TEXT,
        score INTEGER DEFAULT 0,
        subreddit TEXT,
        url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  // If exec_sql doesn't work, try creating via SQL editor manually
  if (error) {
    console.log('⚠️ Cannot create table automatically. You need to run this SQL in Supabase:');
    console.log(`
CREATE TABLE IF NOT EXISTS reddit_data (
  id SERIAL PRIMARY KEY,
  reddit_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  author TEXT,
  score INTEGER DEFAULT 0,
  subreddit TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
    `);
    
    // Try to check if table exists by querying it
    const { error: checkError } = await supabase
      .from('reddit_data')
      .select('id')
      .limit(1);
    
    if (checkError) {
      throw new Error('Please create the reddit_data table manually in Supabase SQL editor');
    }
  }
  
  console.log('✅ Table ready!');
}

async function insertPost(post) {
  try {
    const { error } = await supabase
      .from('reddit_data')
      .insert([{
        reddit_id: post.id,
        title: post.title,
        content: post.content || '',
        author: post.author,
        score: post.score,
        subreddit: post.subreddit,
        url: post.url
      }]);

    if (error) {
      console.warn(`⚠️ Insert failed for ${post.id}: ${error.message}`);
      return false;
    }

    console.log(`✅ Stored: "${post.title.substring(0, 40)}..." (${post.score} pts)`);
    return true;
  } catch (err) {
    console.warn(`⚠️ Error inserting ${post.id}: ${err.message}`);
    return false;
  }
}

async function scrapeRedditPosts() {
  const posts = [];
  
  const queries = [
    'r/whoop',
    'r/fitness search:WHOOP',
    'r/Garmin search:WHOOP'
  ];

  // Get fresh posts about WHOOP
  try {
    console.log('📊 Scraping r/whoop...');
    
    const response = await axios.get('https://www.reddit.com/r/whoop/new.json', {
      params: { limit: 10, raw_json: 1 },
      headers: { 'User-Agent': 'WHOOP-Data-Scraper/1.0' },
      timeout: 10000
    });

    if (response.data?.data?.children) {
      const redditPosts = response.data.data.children
        .map(child => child.data)
        .filter(post => post && post.title && post.id && !post.stickied)
        .slice(0, 8);

      redditPosts.forEach(post => {
        posts.push({
          id: post.id,
          title: post.title,
          content: post.selftext || '',
          author: post.author,
          score: post.score || 0,
          subreddit: 'whoop',
          url: `https://reddit.com${post.permalink}`,
          created_utc: post.created_utc
        });
      });

      console.log(`✅ Scraped ${redditPosts.length} posts from r/whoop`);
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.warn('⚠️ Scraping error:', error.message);
  }

  return posts;
}

async function showStoredData() {
  try {
    const { data, error } = await supabase
      .from('reddit_data')
      .select('id, title, score, subreddit')
      .order('id', { ascending: false })
      .limit(5);

    if (!error && data) {
      console.log('\n📋 Latest stored posts:');
      data.forEach((post, i) => {
        console.log(`${i+1}. "${post.title.substring(0, 50)}..." (${post.score} pts)`);
      });
    }
  } catch (err) {
    console.log('⚠️ Could not verify stored data');
  }
}

// Run it
if (require.main === module) {
  scrapeAndStore()
    .then(count => {
      console.log(`\n🎉 COMPLETE! Stored ${count} real Reddit posts`);
      console.log('🌐 Check your Supabase dashboard table: reddit_data');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ FAILED:', error.message);
      process.exit(1);
    });
}
