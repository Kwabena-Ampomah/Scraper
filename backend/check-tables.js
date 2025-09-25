
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

    // Try to check schema information
    const { data: schemaInfo, error: schemaError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (schemaError) {
      console.log('❌ Could not query schema:', schemaError.message);
      
      // Alternative: Try common table names
      console.log('
🔍 Testing common table names...');
      
      const tablesToTest = ['platforms', 'posts', 'twitter_data', 'embeddings'];
      
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
    } else {
      console.log('📋 Available tables:', schemaInfo.map(t => t.table_name));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkActualTables();

