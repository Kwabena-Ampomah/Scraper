const { Pool } = require('pg');
const logger = require('../utils/logger');

// Parse boolean-like env var
const parseBool = (v, def = false) => {
  if (v === undefined || v === null || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
};

// SSL control: prefer explicit DB_SSL/DATABASE_SSL over NODE_ENV heuristic
const useSSL = parseBool(process.env.DB_SSL ?? process.env.DATABASE_SSL, false);

// Prefer DATABASE_URL if provided (e.g., Railway, Supabase)
const connectionFromUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.DB_URL;

// Database configuration
const dbConfig = connectionFromUrl
  ? {
      connectionString: connectionFromUrl,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'feedback_intelligence',
      password: process.env.DB_PASSWORD || 'password',
      port: Number(process.env.DB_PORT || 5432),
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    };

let pool;

// Create pool if we have either a full connection URL or host/password pair
if (connectionFromUrl || (process.env.DB_HOST && process.env.DB_PASSWORD)) {
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
