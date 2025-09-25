
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkTwitterTables() {
  try {
    // Check if platforms table exists and has Twitter
    const { data: platforms, error: platformError } = await supabase
      .from('platforms')
      .select('*')
      .eq('name', 'twitter');
    
    if (platformError) {
      console.log('❌ Platforms table not found or error:', platformError.message);
    } else {
      console.log('📊 Twitter platform entry:', platforms);
    }

    // Check if posts table exists  
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .limit(1);
    
    if (postsError) {
      console.log('❌ Posts table not found or error:', postsError.message);
    } else {
      console.log('✅ Posts table exists, sample:', posts);
    }

    // Check all available tables
    const { data: tables, error: tablesError } = await supabase
      .rpc('list_tables');
    
    if (tablesError) {
      console.log('❌ Could not list tables:', tablesError.message);
    } else {
      console.log('📋 Available tables:', tables);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkTwitterTables();

