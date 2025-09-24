const { Pool } = require('pg')
const sentimentService = require('../services/sentimentService')

const pool = new Pool({
  user: process.env.DB_USER || 'kwabena',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'feedback_intelligence',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
})

async function analyzeExistingPosts() {
  try {
    console.log('🔍 Fetching posts without sentiment analysis...')
    
    const result = await pool.query(`
      SELECT p.id, p.title, p.content 
      FROM posts p 
      LEFT JOIN sentiment_analysis s ON p.id = s.content_id 
      WHERE s.id IS NULL
    `)
    
    console.log(`📊 Found ${result.rows.length} posts to analyze`)
    
    for (const post of result.rows) {
      try {
        console.log(`📝 Analyzing post: ${post.title.substring(0, 50)}...`)
        
        const textToAnalyze = `${post.title} ${post.content}`.substring(0, 1000)
        const sentiment = await sentimentService.analyzeSentiment(textToAnalyze)
        
        await pool.query(`
          INSERT INTO sentiment_analysis (
            content_id, content_type, sentiment_score, sentiment_label, 
            confidence, emotions, keywords, analyzed_at, model_version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
        `, [
          post.id,
          'post',
          sentiment.score,
          sentiment.label,
          sentiment.confidence,
          JSON.stringify(sentiment.emotions),
          sentiment.keywords,
          'v1.0'
        ])
        
        console.log(`✅ Analyzed: ${sentiment.label} (${sentiment.score})`)
        
      } catch (error) {
        console.error(`❌ Error analyzing post ${post.id}:`, error.message)
      }
    }
    
    console.log('🎉 Sentiment analysis complete!')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

analyzeExistingPosts()
