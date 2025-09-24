# ETL Pipeline Architecture

## Overview

This ETL (Extract, Transform, Load) pipeline implements the complete data flow described in `spec.md` for the User Feedback Intelligence Platform:

**Reddit Scraper → Text Cleaner → PostgreSQL → OpenAI Embeddings → Supabase Vector DB**

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Reddit API    │───▶│  Text Cleaner   │───▶│   PostgreSQL    │
│   (Scraping)    │    │ (Preprocessing)  │    │   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐           ▼
│ Supabase Vector │◀───│ OpenAI Embeddings│◀──────────┘
│   (Search)      │    │   (Vectors)      │
└─────────────────┘    └─────────────────┘
```

## Components

### 1. Reddit Scraper (`redditScraper.js`)
- **Purpose**: Extract posts and comments from Reddit
- **Features**:
  - Multiple subreddit support
  - Search term filtering
  - Rate limiting and error handling
  - Comment extraction
  - Subreddit metadata

### 2. Text Cleaner (`textCleaner.js`)
- **Purpose**: Clean and preprocess raw text data
- **Features**:
  - Reddit-specific formatting removal
  - Keyword extraction
  - Entity recognition (products, features, emotions)
  - Text statistics and readability scores
  - Batch processing

### 3. Embeddings Service (`embeddingsService.js`)
- **Purpose**: Generate vector embeddings using OpenAI
- **Features**:
  - OpenAI text-embedding-ada-002 model
  - Batch processing with rate limiting
  - Cost calculation and token tracking
  - Retry logic and error handling
  - Similarity calculations

### 4. Supabase Vector Service (`supabaseVectorService.js`)
- **Purpose**: Store and search vector embeddings
- **Features**:
  - pgvector integration
  - Similarity search
  - Batch indexing
  - Metadata storage
  - Query embedding generation

### 5. Pipeline Orchestrator (`pipelineOrchestrator.js`)
- **Purpose**: Coordinate the entire ETL process
- **Features**:
  - Service initialization and coordination
  - Cron scheduling
  - Statistics and monitoring
  - Error handling and recovery
  - Health checks

## Usage

### CLI Script
```bash
# Run once with default settings
node backend/scripts/runPipeline.js

# Custom configuration
node backend/scripts/runPipeline.js --subreddit fitness --terms "fitness tracker" --limit 200

# Schedule to run every 6 hours
node backend/scripts/runPipeline.js --schedule "0 */6 * * *"
```

### Programmatic Usage
```javascript
const PipelineOrchestrator = require('./pipelineOrchestrator');

const orchestrator = new PipelineOrchestrator();
await orchestrator.initialize();

// Run once
const result = await orchestrator.runCustomPipeline({
  subreddit: 'whoop',
  searchTerms: ['WHOOP 5.0'],
  limit: 100
});

// Schedule
orchestrator.schedulePipeline('0 */6 * * *', config);
```

## Configuration

### Environment Variables
```bash
# Database
DB_USER=kwabena
DB_HOST=localhost
DB_NAME=feedback_intelligence
DB_PASSWORD=
DB_PORT=5432

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Pipeline Configuration
```javascript
const config = {
  scraping: {
    subreddit: 'whoop',
    searchTerms: ['WHOOP 5.0', 'WHOOP 4.0'],
    limit: 100,
    timeframe: 'month',
    sort: 'new'
  },
  processing: {
    batchSize: 100,
    enableEntityExtraction: true,
    enableKeywordExtraction: true
  },
  embeddings: {
    model: 'text-embedding-ada-002',
    batchSize: 100
  },
  indexing: {
    batchSize: 100,
    upsertMode: true
  }
};
```

## Data Flow

### 1. Extraction (Reddit Scraper)
- Fetch posts from Reddit API
- Extract metadata (score, comments, author, etc.)
- Handle rate limiting and errors

### 2. Transformation (Text Cleaner)
- Clean Reddit-specific formatting
- Extract keywords and entities
- Calculate text statistics
- Normalize data structure

### 3. Storage (PostgreSQL)
- Store processed posts in `posts` table
- Store sentiment analysis in `sentiment_analysis` table
- Maintain referential integrity

### 4. Embedding (OpenAI)
- Generate vector embeddings for cleaned text
- Handle token limits and batching
- Track costs and usage

### 5. Indexing (Supabase Vector DB)
- Store embeddings in `embeddings` table
- Enable similarity search
- Maintain metadata for search context

## Monitoring

### Statistics
- Total scraped items
- Processing success/failure rates
- Embedding generation costs
- Indexing performance
- Pipeline run history

### Health Checks
- Service connectivity
- Database health
- API rate limits
- Error rates

### Logging
- Structured JSON logging
- Error tracking
- Performance metrics
- Debug information

## Error Handling

### Retry Logic
- Exponential backoff for API calls
- Configurable retry attempts
- Graceful degradation

### Fallback Mechanisms
- Continue processing on partial failures
- Skip invalid items
- Maintain data consistency

### Monitoring
- Error rate tracking
- Performance metrics
- Alert thresholds

## Performance Considerations

### Rate Limiting
- Reddit API: 1 second between requests
- OpenAI API: 1 second between batches
- Supabase: 500ms between batches

### Batching
- Text processing: 100 items per batch
- Embeddings: 100 items per batch
- Indexing: 100 items per batch

### Memory Management
- Stream processing for large datasets
- Garbage collection optimization
- Resource cleanup

## Future Enhancements

### Additional Data Sources
- Twitter API integration
- Company forums
- Support tickets
- App store reviews

### Advanced Processing
- Sentiment analysis integration
- Topic modeling
- Named entity recognition
- Language detection

### Scalability
- Horizontal scaling
- Load balancing
- Distributed processing
- Caching layers

## Troubleshooting

### Common Issues
1. **Reddit API Rate Limits**: Increase delays between requests
2. **OpenAI Token Limits**: Reduce batch sizes or text length
3. **Database Connection**: Check connection pool settings
4. **Memory Issues**: Reduce batch sizes

### Debug Mode
```bash
# Enable debug logging
DEBUG=true node backend/scripts/runPipeline.js
```

### Health Check
```javascript
const health = await orchestrator.healthCheck();
console.log(health);
```
