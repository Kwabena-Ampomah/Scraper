/**
 * BACKEND SERVER - MAIN APPLICATION ENTRY POINT
 * 
 * Purpose: Core Express.js server that handles all API requests for the User Feedback Intelligence Platform
 * 
 * Key Responsibilities:
 * - Sets up Express server with middleware (CORS, security, rate limiting)
 * - Configures API routes for data scraping, sentiment analysis, and dashboard insights
 * - Handles database connections to Supabase
 * - Provides RESTful endpoints for frontend consumption
 * - Manages error handling and request logging
 * 
 * Dependencies:
 * - Routes: reddit, insights, health, search endpoints
 * - Database: Supabase PostgreSQL connection
 * - External APIs: Reddit JSON API for real-time data scraping
 * 
 * Environment Variables Required:
 * - PORT: Server port (default 3001)
 * - SUPABASE_URL: Database connection URL
 * - SUPABASE_ANON_KEY: Database authentication key
 * 
 * Impact on System:
 * - Changes here affect all API endpoints and server behavior
 * - Middleware changes impact security, CORS, and rate limiting
 * - Route modifications affect frontend API calls
 * - Error handling changes affect debugging and monitoring
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const redditRoutes = require('./routes/reddit');
const twitterRoutes = require('./routes/twitter');
const sentimentRoutes = require('./routes/sentiment');
const searchRoutes = require('./routes/search');
const searchRedditRoutes = require('./routes/searchReddit');
const insightsRoutes = require('./routes/insights');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware (must be before helmet)
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const allowedOrigins = allowedOriginsEnv ? allowedOriginsEnv.split(',').map(s => s.trim()) : null;

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or if no restriction configured
    if (!origin || !allowedOrigins) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// Debug CORS
app.use((req, res, next) => {
  console.log('🌐 CORS Debug:', {
    origin: req.headers.origin,
    method: req.method,
    url: req.url,
    allowedOrigins: allowedOrigins || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']
  });
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/reddit', redditRoutes);
app.use('/api/twitter', twitterRoutes);
app.use('/api/sentiment', sentimentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/search-reddit', searchRedditRoutes);
app.use('/api/insights', insightsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'User Feedback Intelligence Platform API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      reddit: '/api/reddit',
      twitter: '/api/twitter',
      sentiment: '/api/sentiment',
      search: '/api/search',
      insights: '/api/insights'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
