# User Feedback Intelligence Platform - Backend API

A comprehensive Express.js + PostgreSQL backend for analyzing user sentiment across Reddit, Twitter, and other platforms.

## 🚀 Features

- **Multi-Platform Scraping**: Reddit and Twitter data collection
- **Sentiment Analysis**: NLP-powered sentiment classification
- **Vector Search**: Semantic search using OpenAI embeddings
- **Insights Generation**: Automated theme clustering and analysis
- **Real-time Processing**: Continuous data processing and analysis
- **RESTful API**: Comprehensive API endpoints for all features

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 13+
- Redis (optional, for caching)
- API Keys for external services

## 🛠 Installation

1. **Clone and navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Set up PostgreSQL database**:
   ```bash
   # Create database
   createdb feedback_intelligence
   
   # Run schema
   psql -d feedback_intelligence -f database/schema.sql
   ```

5. **Start the server**:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Required Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=feedback_intelligence
DB_USER=postgres
DB_PASSWORD=password

# API Keys
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

# Server
PORT=3000
NODE_ENV=development
```

### Optional Services

- **Supabase**: Alternative vector database
- **Redis**: Caching layer
- **API Key**: Authentication

## 📚 API Endpoints

### Health Check
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed system status
- `GET /api/health/metrics` - System metrics

### Reddit Scraping
- `POST /api/reddit/scrape` - Scrape Reddit posts
- `GET /api/reddit/jobs` - Get scraping jobs status
- `GET /api/reddit/posts` - Get scraped posts with sentiment

### Twitter Scraping
- `POST /api/twitter/scrape` - Scrape Twitter posts
- `GET /api/twitter/posts` - Get scraped tweets with sentiment
- `GET /api/twitter/trending` - Get trending topics

### Sentiment Analysis
- `POST /api/sentiment/analyze` - Analyze single text
- `POST /api/sentiment/batch` - Batch analyze multiple texts
- `GET /api/sentiment/stats/:productId` - Get sentiment statistics
- `GET /api/sentiment/trends/:productId` - Get sentiment trends
- `GET /api/sentiment/keywords/:productId` - Get keywords by sentiment

### Vector Search
- `POST /api/search/semantic` - Semantic search using embeddings
- `POST /api/search/natural-language` - Natural language queries
- `GET /api/search/keywords` - Keyword-based search
- `POST /api/search/advanced` - Advanced search with filters
- `GET /api/search/suggestions` - Search suggestions

### Insights & Analytics
- `POST /api/insights/generate` - Generate insights for product
- `GET /api/insights/:productId` - Get insights for product
- `GET /api/insights/dashboard/:productId` - Dashboard data
- `GET /api/insights/clusters/:productId` - Thematic clusters
- `GET /api/insights/pain-points/:productId` - Pain points analysis
- `GET /api/insights/feature-requests/:productId` - Feature requests

## 🔍 Usage Examples

### Scrape Reddit Posts
```bash
curl -X POST http://localhost:3000/api/reddit/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "subreddit": "whoop",
    "searchTerms": ["WHOOP 5.0", "sleep tracking"],
    "productId": "your-product-uuid",
    "limit": 25
  }'
```

### Analyze Sentiment
```bash
curl -X POST http://localhost:3000/api/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I love the new WHOOP 5.0 sleep tracking feature!",
    "contentType": "post"
  }'
```

### Semantic Search
```bash
curl -X POST http://localhost:3000/api/search/semantic \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are users saying about battery life?",
    "productId": "your-product-uuid",
    "limit": 20
  }'
```

### Generate Insights
```bash
curl -X POST http://localhost:3000/api/insights/generate \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "your-product-uuid",
    "platform": "reddit",
    "timeframe": "30d"
  }'
```

## 🏗 Architecture

### Core Components

1. **Express Server** (`server.js`)
   - Main application entry point
   - Middleware configuration
   - Route registration

2. **Database Layer** (`database/`)
   - PostgreSQL connection management
   - Schema definitions
   - Query helpers

3. **Services** (`services/`)
   - Sentiment analysis
   - Vector operations
   - Insights generation

4. **Routes** (`routes/`)
   - API endpoint handlers
   - Request validation
   - Response formatting

5. **Middleware** (`middleware/`)
   - Error handling
   - Authentication
   - Rate limiting

### Data Flow

1. **Data Collection**: Scrape Reddit/Twitter → Store in PostgreSQL
2. **Processing**: Analyze sentiment → Generate embeddings
3. **Storage**: Store embeddings in Pinecone/Supabase
4. **Analysis**: Generate insights → Cluster themes
5. **API**: Serve processed data via REST endpoints

## 🔒 Security

- **Rate Limiting**: Prevents API abuse
- **CORS**: Configurable cross-origin policies
- **Input Validation**: Request validation and sanitization
- **Error Handling**: Secure error responses
- **API Keys**: Optional authentication

## 📊 Monitoring

- **Health Checks**: System status monitoring
- **Logging**: Winston-based logging with rotation
- **Metrics**: Performance and usage metrics
- **Error Tracking**: Comprehensive error logging

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t feedback-intelligence-api .

# Run container
docker run -p 3000:3000 --env-file .env feedback-intelligence-api
```

### Production Considerations

1. **Environment Variables**: Set all required environment variables
2. **Database**: Use managed PostgreSQL service
3. **Scaling**: Consider horizontal scaling for high load
4. **Monitoring**: Implement APM and logging
5. **Security**: Use HTTPS and proper authentication

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --grep "sentiment"
```

## 📈 Performance

- **Database Indexing**: Optimized queries with proper indexes
- **Caching**: Redis integration for frequently accessed data
- **Rate Limiting**: Prevents system overload
- **Connection Pooling**: Efficient database connections
- **Async Processing**: Non-blocking operations

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Create GitHub issue
- Check documentation
- Review API examples
- Contact development team
