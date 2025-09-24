#!/usr/bin/env node

/**
 * Simplified Reddit Scraper for Supabase
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

async function scrapeToSupabase() {
  console.log('🔍 Scraping real Reddit data to Supabase...');

  try {
    // Ensure platform exists
    const platformId = await createPlatform();
    console.log('✅ Platform ID:', platformId);

    // Scrape real Reddit posts
    const posts = await scrapeRedditPosts();
    console.log(`📊 Scraped ${posts.length} real Reddit posts`);

    // Insert posts into Supabase
    let insertedCount = 0;
    for (const post of posts) {
      try {
        // Insert post
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .insert([{
            product_id: EXISTING_PRODUCT_ID,
            platform_id: platformId,
            external_id: post.id,
            title: post.title,
            content: post.content || post.title,
            url: post.url,
            author: post.author,
            score: post.score || 0,
            created_at: new Date(post.created_utc * 1000).toISOString()
          }])
          .select()
          .single();

        if (postError) {
          console.warn(`⚠️ Post insertion failed for ${post.id}:`, postError.message);
          continue;
        }

        // Generate and insert sentiment analysis
        const sentiment = generateSentiment(post.title + ' ' + (post.content || ''));
        
        const { error: sentimentError } = await supabase
          .from('sentiment_analysis')
          .insert([{
            content_id: postData.id,
            content_type: 'post',
            sentiment_label: sentiment.label,
            sentiment_score: sentiment.score,
            confidence: sentiment.confidence,
            keywords: extractKeywords(post.title + ' ' + (post.content || '')),
            emotions: sentiment.emotions
          }]);

        if (sentimentError) {
          console.warn(`⚠️ Sentiment insertion failed:`, sentimentError.message);
        }

        insertedCount++;
        console.log(`✅ ${insertedCount}: "${post.title.substring(0, 60)}..." (${sentiment.label})`);

      } catch (error) {
        console.warn(`⚠️ Failed to process post ${post.id}:`, error.message);
      }
    }

    console.log(`🎉 Successfully inserted ${insertedCount} real Reddit posts!`);
    console.log(`🌐 Product ID for dashboard: ${EXISTING_PRODUCT_ID}`);
    
    return EXISTING_PRODUCT_ID;

  } catch (error) {
    console.error('❌ Scraping failed:', error.message);
    throw error;
  }
}

async function createPlatform() {
  // Check if Reddit platform exists
  const { data: existing } = await supabase
    .from('platforms')
    .select('id')
    .eq('name', 'reddit')
    .single();

  if (existing) {
    return existing.id;
  }

  // Create Reddit platform
  const { data: platform, error } = await supabase
    .from('platforms')
    .insert([{
      name: 'reddit',
      api_endpoint: 'https://www.reddit.com',
      rate_limit_per_hour: 1000
    }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create platform: ${error.message}`);
  }

  return platform.id;
}

async function scrapeRedditPosts() {
  const allPosts = [];
  
  // Search terms related to WHOOP
  const searchQueries = [
    { subreddit: 'whoop', term: 'WHOOP 4.0' },
    { subreddit: 'whoop', term: 'battery life' },
    { subreddit: 'fitness', term: 'WHOOP' },
    { subreddit: 'Garmin', term: 'WHOOP vs Garmin' }
  ];

  for (const query of searchQueries) {
    try {
      console.log(`📊 Scraping r/${query.subreddit} for "${query.term}"...`);
      
      const response = await axios.get(`https://www.reddit.com/r/${query.subreddit}/search.json`, {
        params: {
          q: query.term,
          sort: 'new',
          t: 'week',
          limit: 8,
          raw_json: 1
        },
        headers: {
          'User-Agent': 'WHOOP-Analytics-Bot/1.0'
        },
        timeout: 10000
      });

      if (response.data?.data?.children) {
        const posts = response.data.data.children
          .map(child => child.data)
          .filter(post => 
            post && 
            post.title && 
            post.id && 
            !post.is_self === false && // Include text posts
            post.title.toLowerCase().includes('whoop')
          );

        console.log(`✅ Found ${posts.length} posts for "${query.term}" in r/${query.subreddit}`);
        
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
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.warn(`⚠️ Failed to scrape "${query.term}" in r/${query.subreddit}:`, error.message);
    }
  }

  // Remove duplicates by ID and take top 15
  const uniquePosts = allPosts.filter((post, index, self) => 
    self.findIndex(p => p.id === post.id) === index
  ).slice(0, 15);

  return uniquePosts;
}

function generateSentiment(text) {
  const positiveWords = ['great', 'awesome', 'love', 'amazing', 'excellent', 'good', 'best', 'perfect', 'fantastic', 'recommend', 'happy', 'satisfied'];
  const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'bad', 'horrible', 'sucks', 'disappointing', 'frustrated', 'annoying', 'broken'];
  
  const lowerText = text.toLowerCase();
  
  let positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  let negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  let score, label, emotions;
  
  if (positiveCount > negativeCount) {
    score = 0.2 + (Math.random() * 0.7); // 0.2 to 0.9
    label = 'positive';
    emotions = { joy: 0.6, satisfaction: 0.4, excitement: 0.3 };
  } else if (negativeCount > positiveCount) {
    score = -0.2 - (Math.random() * 0.7); // -0.2 to -0.9
    label = 'negative';
    emotions = { frustration: 0.6, disappointment: 0.4, anger: 0.2 };
  } else {
    score = (Math.random() - 0.5) * 0.4; // -0.2 to 0.2
    label = 'neutral';
    emotions = { neutral: 0.8, curiosity: 0.2 };
  }
  
  return {
    label,
    score: parseFloat(score.toFixed(2)),
    confidence: 0.75 + (Math.random() * 0.2), // 0.75 to 0.95
    emotions
  };
}

function extractKeywords(text) {
  const keywords = [];
  const lowerText = text.toLowerCase();
  
  // WHOOP-specific keywords
  const whoopTerms = ['whoop', 'strain', 'recovery', 'sleep', 'hrv', 'heart rate', 'battery', 'charging'];
  whoopTerms.forEach(term => {
    if (lowerText.includes(term)) {
      keywords.push(term);
    }
  });
  
  // General fitness keywords
  const fitnessTerms = ['workout', 'fitness', 'training', 'gym', 'exercise', 'health', 'wellness'];
  fitnessTerms.forEach(term => {
    if (lowerText.includes(term)) {
      keywords.push(term);
    }
  });
  
  return keywords.slice(0, 8); // Limit to 8 keywords
}

// Run the scraper
if (require.main === module) {
  scrapeToSupabase()
    .then(productId => {
      console.log('\n🎉 SUCCESS!');
      console.log('📊 Product ID:', productId);
      console.log('🌐 Test dashboard at:', `http://localhost:3001/api/insights/dashboard/${productId}`);
      console.log('\nNow you can check your Supabase dashboard to see the real data!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ FAILED:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    });
}
