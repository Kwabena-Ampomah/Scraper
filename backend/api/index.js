// Vercel serverless function wrapper for Express app
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

// CORS middleware (must be before helmet)
app.use(cors({
  origin: true, // Allow all origins for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

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

// Error handling middleware (must be last)
app.use(errorHandler);

// Export for Vercel
module.exports = app;
