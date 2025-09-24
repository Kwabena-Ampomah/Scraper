const { pool } = require('../database/connection');

async function insertSampleRealData() {
  console.log('🚀 Inserting sample real-looking data...');
  
  try {
    // Ensure product exists
    await pool.query(`
      INSERT INTO products (id, name, subreddit, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, ['412ac63f-91be-4f26-bf66-2de7b9158126', 'WHOOP 5.0', 'whoop']);
    
    // Insert realistic Reddit posts
    const samplePosts = [
      {
        id: `reddit_${Date.now()}_1`,
        title: "WHOOP 5.0 battery life is amazing - 5 days!",
        content: "Just got my WHOOP 5.0 and the battery life is incredible. Getting 5+ days with constant heart rate monitoring. The new sensor accuracy is also noticeably better than 4.0.",
        author: "fitness_enthusiast_2024",
        subreddit: "whoop",
        score: 247,
        num_comments: 34,
        sentiment_score: 0.8,
        created_utc: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      },
      {
        id: `reddit_${Date.now()}_2`,
        title: "WHOOP 5.0 vs Apple Watch for fitness tracking?",
        content: "Considering switching from Apple Watch to WHOOP 5.0. Has anyone made this switch? How does the sleep tracking compare? Really interested in the recovery metrics.",
        author: "runner_girl_23",
        subreddit: "fitness",
        score: 156,
        num_comments: 89,
        sentiment_score: 0.3,
        created_utc: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      },
      {
        id: `reddit_${Date.now()}_3`,
        title: "WHOOP 5.0 strain coach feature is a game changer",
        content: "The new strain coach in WHOOP 5.0 has completely changed how I approach my workouts. It tells me exactly when to push harder or when to recover. Love the real-time feedback during sessions.",
        author: "crossfit_coach_alex",
        subreddit: "whoop",
        score: 312,
        num_comments: 67,
        sentiment_score: 0.9,
        created_utc: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      },
      {
        id: `reddit_${Date.now()}_4`,
        title: "WHOOP 5.0 subscription cost worth it?",
        content: "Been using WHOOP 5.0 for 3 months. The monthly subscription is pricey but the insights are incredible. The sleep optimization recommendations alone have improved my recovery significantly.",
        author: "biohacker_mike",
        subreddit: "biohacking",
        score: 198,
        num_comments: 45,
        sentiment_score: 0.6,
        created_utc: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      },
      {
        id: `reddit_${Date.now()}_5`,
        title: "WHOOP 5.0 sizing issues - band too tight",
        content: "Anyone else having issues with WHOOP 5.0 band sizing? Even the largest size feels too tight during workouts. The sensor accuracy seems affected when it's not snug though.",
        author: "marathon_runner_2024",
        subreddit: "whoop",
        score: 89,
        num_comments: 23,
        sentiment_score: -0.3,
        created_utc: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
      }
    ];
    
    for (const post of samplePosts) {
      await pool.query(`
        INSERT INTO reddit_posts (
          id, title, content, author, subreddit, score, num_comments, 
          sentiment_score, created_utc, product_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        post.id, post.title, post.content, post.author, post.subreddit,
        post.score, post.num_comments, post.sentiment_score, post.created_utc,
        '412ac63f-91be-4f26-bf66-2de7b9158126'
      ]);
    }
    
    // Check final count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM reddit_posts WHERE product_id = $1',
      ['412ac63f-91be-4f26-bf66-2de7b9158126']
    );
    
    console.log(`🎉 Successfully inserted sample data! Total posts: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error inserting data:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  insertSampleRealData();
}

module.exports = insertSampleRealData;
