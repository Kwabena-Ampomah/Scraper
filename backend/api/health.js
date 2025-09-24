// Vercel API function for health check
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Test database connection
    let dbStatus = 'healthy';
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.DB_URL
      });
      await pool.query('SELECT 1');
      await pool.end();
    } catch (error) {
      dbStatus = 'error';
    }

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: { status: dbStatus },
        openai: { status: process.env.OPENAI_API_KEY ? 'configured' : 'not configured' },
        supabase: { status: process.env.SUPABASE_URL ? 'configured' : 'not configured' }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
