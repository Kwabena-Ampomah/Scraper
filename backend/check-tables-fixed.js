const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkActualTables() {
  try {
    // Check reddit_data table (we know this exists)
    const { data: redditData, error: redditError } = await supabase
      .from('reddit_data')
      .select('*')
      .limit(1);
    
    if (redditError) {
      console.log('❌ reddit_data table error:', redditError.message);
    } else {
      console.log('✅ reddit_data table exists, sample:', redditData);
    }

    console.log('\n🔍 Testing Twitter-related table names...');
    
    const tablesToTest = ['platforms', 'posts', 'twitter_data', 'embeddings', 'scraping_jobs', 'sentiment_analysis'];
    
    for (const tableName of tablesToTest) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: exists with sample data:`, data);
        }
      } catch (e) {
        console.log(`❌ ${tableName}: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkActualTables();
