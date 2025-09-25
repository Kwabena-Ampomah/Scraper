const fs = require('fs');

// Simple test to call our Supabase function directly
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDirectSupabase() {
  try {
    console.log('Testing direct Supabase call...');
    
    // Replicate the same query from generateDashboardDataFromSupabase
    const { data: redditData, error: redditError } = await supabase.from('reddit_data').select('*');
    
    if (redditError) {
      console.error('Supabase reddit_data query error:', redditError);
      return;
    }

    console.log(`Found ${redditData.length} records`);
    console.log('Sample record:', redditData[0]);
    
    // Replicate the sentiment calculation
    const totalPosts = redditData?.length || 0;
    
    // Analyze sentiment based on score (Reddit upvotes/downvotes)
    const positiveCount = redditData.filter(post => post.score > 10).length;
    const negativeCount = redditData.filter(post => post.score < 0).length;
    const neutralCount = totalPosts - positiveCount - negativeCount;
    
    console.log('Sentiment analysis:');
    console.log('Total posts:', totalPosts);
    console.log('Positive count:', positiveCount);
    console.log('Negative count:', negativeCount);
    console.log('Neutral count:', neutralCount);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDirectSupabase();
