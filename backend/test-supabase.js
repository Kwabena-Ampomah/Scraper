
const { generateDashboardDataFromSupabase } = require('./routes/insights.js');

async function test() {
  try {
    const result = await generateDashboardDataFromSupabase('412ac63f-91be-4f26-bf66-2de7b9158126', 'all', '30d');
    console.log('Total posts:', result.sentiment.totalPosts);
    console.log('Full sentiment object:', JSON.stringify(result.sentiment, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();

