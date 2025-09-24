const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'feedback_intelligence',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

let pool;

// Only create pool if we have database configuration
if (process.env.DB_HOST && process.env.DB_PASSWORD) {
  pool = new Pool(dbConfig);

  // Test database connection
  pool.on('connect', () => {
    logger.info('📊 Connected to PostgreSQL database');
  });

  pool.on('error', (err) => {
    logger.error('❌ Database connection error:', err);
  });
} else {
  logger.warn('⚠️ Database not configured - running without PostgreSQL connection');
}

// Database query helper
const query = async (text, params) => {
  if (!pool) {
    throw new Error('Database not configured');
  }
  
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error:', { error: error.message, query: text });
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  if (!pool) {
    throw new Error('Database not configured');
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Close all connections
const close = async () => {
  if (pool) {
    await pool.end();
    logger.info('🔒 Database connections closed');
  }
};

module.exports = {
  query,
  transaction,
  close,
  pool
};
