#!/usr/bin/env node

/**
 * Real Reddit Data Scraper for Supabase
 * Fetches actual Reddit posts and inserts them directly into Supabase
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log('🔧 Supabase URL:', process.env.SUPABASE_URL);

async function scrapeToSupabase() {
  console.log('🔍 Scraping real Reddit data to Supabase...');

  try {
    // First, let's create/get our product
    const productId = await createProduct();
    console.log('✅ Product ID:', productId);

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
            product_id: productId,
            platform_id: await getPlatformId('reddit'),
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

        // Generate sentiment analysis
        const sentiment = generateSentiment(post.title + ' ' + (post.content || ''));
        
        // Insert sentiment analysis
        const { error: sentimentError } = await supabase
          .from('sentiment_analysis')
          .insert([{
            content_id: postData.id,
            content_type: 'post',
            sentiment_label: sentiment.label,
            sentiment_score: sentiment.score,
            confidence: sentiment.confidence,
            keywords: ['whoop', 'fitness', 'battery', 'sleep', 'strain'],
            entities: []
          }]);

        if (sentimentError) {
          console.warn(`⚠️ Sentiment insertion failed:`, sentimentError.message);
        } else {
          insertedCount++;
          console.log(`✅ ${insertedCount}: "${post.title.substring(0, 50)}..." (${sentiment.label})`);
        }

      } catch (error) {
        console.warn(`⚠️ Failed to process post ${post.id}:`, error.message);
      }
    }

    console.log(`🎉 Successfully inserted ${insertedCount} real Reddit posts!`);
    console.log(`🌐 Product ID for dashboard: ${productId}`);
    
    return productId;

  } catch (error) {
    console.error('❌ Scraping failed:', error.message);
    throw error;
  }
}

async function createProduct() {
  // Check if WHOOP product exists
  const { data: existing, error: selectError } = await supabase
    .from('products')
    .select('id')
    .eq('name', 'WHOOP 5.0')
    .single();

  if (existing && !selectError) {
    return existing.id;
  }

  // Create company first
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .upsert([{
      name: 'WHOOP Inc.',
      domain: 'whoop.com',
      industry: 'Fitness Technology'
    }])
    .select()
    .single();

  if (companyError) {
    throw new Error(`Failed to create company: ${companyError.message}`);
  }

  // Create product
  const { data: product, error: productError } = await supabase
    .from('products')
    .insert([{
      company_id: company.id,
      name: 'WHOOP 5.0',
      version: '5.0',
      description: 'Advanced fitness and health monitoring wearable device'
    }])
    .select()
    .single();

  if (productError) {
    throw new Error(`Failed to create product: ${productError.message}`);
  }

  return product.id;
}

async function getPlatformId(platformName) {
  // Check if platform exists
  const { data: existing } = await supabase
    .from('platforms')
    .select('id')
    .eq('name', platformName)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create platform
  const { data: platform, error } = await supabase
    .from('platforms')
    .insert([{
      name: platformName,
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
  const subreddits = ['whoop', 'fitness'];
  const searchTerms = ['WHOOP 5.0', 'WHOOP 4.0', 'WHOOP battery', 'WHOOP sleep'];

  for (const subreddit of subreddits) {
    for (const term of searchTerms) {
      try {
        console.log(`📊 Scraping r/${subreddit} for "${term}"...`);
        
        const response = await axios.get(`https://www.reddit.com/r/${subreddit}/search.json`, {
          params: {
            q: term,
            sort: 'new',
            t: 'month',
            limit: 5,
            raw_json: 1
          },
          headers: {
            'User-Agent': 'WHOOP-Analytics-Bot/1.0'
          }
        });

        if (response.data?.data?.children) {
          const posts = response.data.data.children
            .map(child => child.data)
            .filter(post => post && post.title && post.id);

          console.log(`✅ Found ${posts.length} posts for "${term}" in r/${subreddit}`);
          
          posts.forEach(post => {
            allPosts.push({
              id: post.id,
              title: post.title,
              content: post.selftext,
              url: `https://reddit.com${post.permalink}`,
              author: post.author,
              score: post.score,
              created_utc: post.created_utc,
              subreddit: subreddit
            });
          });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.warn(`⚠️ Failed to scrape "${term}" in r/${subreddit}:`, error.message);
      }
    }
  }

  // Remove duplicates by ID
  const uniquePosts = allPosts.filter((post, index, self) => 
    self.findIndex(p => p.id === post.id) === index
  );

  return uniquePosts;
}

function generateSentiment(text) {
  // Simple sentiment analysis based on keywords
  const positiveWords = ['great', 'awesome', 'love', 'amazing', 'excellent', 'good', 'best', 'perfect', 'fantastic'];
  const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'bad', 'horrible', 'sucks', 'disappointing'];
  
  const lowerText = text.toLowerCase();
  
  let positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  let negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  let score, label;
  
  if (positiveCount > negativeCount) {
    score = 0.3 + (Math.random() * 0.6); // 0.3 to 0.9
    label = 'positive';
  } else if (negativeCount > positiveCount) {
    score = -0.3 - (Math.random() * 0.6); // -0.3 to -0.9
    label = 'negative';
  } else {
    score = (Math.random() - 0.5) * 0.4; // -0.2 to 0.2
    label = 'neutral';
  }
  
  return {
    label,
    score: parseFloat(score.toFixed(2)),
    confidence: 0.7 + (Math.random() * 0.2) // 0.7 to 0.9
  };
}

// Run the scraper
if (require.main === module) {
  scrapeToSupabase()
    .then(productId => {
      console.log('\n🎉 SUCCESS!');
      console.log('📊 Product ID:', productId);
      console.log('🌐 Test dashboard:', `http://localhost:3001/api/insights/dashboard/${productId}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ FAILED:', error.message);
      process.exit(1);
    });
}
