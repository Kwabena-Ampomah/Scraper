# ETL Pipeline Architecture Diagram

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ETL PIPELINE ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   REDDIT API    │───▶│  TEXT CLEANER   │───▶│   POSTGRESQL    │───▶│ OPENAI EMBEDDINGS│
│                 │    │                 │    │                 │    │                 │
│ • Subreddit     │    │ • Format Clean  │    │ • Posts Table   │    │ • text-embedding│
│ • Search Terms  │    │ • Keywords      │    │ • Sentiment     │    │   -ada-002      │
│ • Rate Limiting │    │ • Entities      │    │ • Metadata      │    │ • Batch Process │
│ • Error Handle  │    │ • Statistics    │    │ • Relationships │    │ • Cost Tracking │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         ▼                       ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   RAW DATA      │    │ PROCESSED DATA  │    │ STRUCTURED DATA │    │ VECTOR EMBEDDINGS│
│                 │    │                 │    │                 │    │                 │
│ • Posts         │    │ • Cleaned Text  │    │ • Normalized    │    │ • 1536 dims     │
│ • Comments      │    │ • Keywords      │    │ • Indexed       │    │ • Metadata      │
│ • Metadata      │    │ • Entities      │    │ • Relational    │    │ • Similarity    │
│ • Timestamps    │    │ • Features      │    │ • Queryable     │    │ • Searchable    │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
                                                                              │
                                                                              ▼
                                                                   ┌─────────────────┐
                                                                   │ SUPABASE VECTOR │
                                                                   │                 │
                                                                   │ • pgvector      │
                                                                   │ • Similarity    │
                                                                   │ • Search        │
                                                                   │ • Indexing      │
                                                                   └─────────────────┘
```

## Service Components

### 1. Reddit Scraper Service
```
┌─────────────────────────────────────────────────────────────────┐
│                        REDDIT SCRAPER                           │
├─────────────────────────────────────────────────────────────────┤
│ Input:  subreddit, searchTerms, limit, timeframe                │
│ Output: Raw Reddit posts and comments                          │
│                                                                 │
│ Features:                                                       │
│ • Reddit API integration                                        │
│ • Multiple subreddit support                                    │
│ • Search term filtering                                          │
│ • Rate limiting (1s between requests)                          │
│ • Error handling and retries                                     │
│ • Comment extraction                                             │
│ • Subreddit metadata                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Text Cleaner Service
```
┌─────────────────────────────────────────────────────────────────┐
│                        TEXT CLEANER                            │
├─────────────────────────────────────────────────────────────────┤
│ Input:  Raw Reddit posts                                        │
│ Output: Cleaned and processed text data                        │
│                                                                 │
│ Features:                                                       │
│ • Reddit formatting removal                                     │
│ • Keyword extraction (top 15)                                  │
│ • Entity recognition (products, features, emotions)             │
│ • Text statistics (word count, readability)                     │
│ • Batch processing (100 items)                                 │
│ • Stop word filtering                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3. PostgreSQL Storage
```
┌─────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL STORAGE                        │
├─────────────────────────────────────────────────────────────────┤
│ Tables:                                                         │
│ • posts (id, title, content, author, score, etc.)               │
│ • sentiment_analysis (sentiment_score, confidence, etc.)        │
│ • embeddings (content_id, embedding_vector, metadata)          │
│                                                                 │
│ Features:                                                       │
│ • ACID compliance                                               │
│ • Relational integrity                                          │
│ • Indexing and querying                                         │
│ • Connection pooling                                            │
│ • Transaction management                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 4. OpenAI Embeddings Service
```
┌─────────────────────────────────────────────────────────────────┐
│                    OPENAI EMBEDDINGS SERVICE                    │
├─────────────────────────────────────────────────────────────────┤
│ Model:  text-embedding-ada-002                                  │
│ Input:  Cleaned text (max 6000 chars)                          │
│ Output: 1536-dimensional vectors                               │
│                                                                 │
│ Features:                                                       │
│ • Batch processing (100 items)                                 │
│ • Rate limiting (1s between batches)                          │
│ • Cost calculation and tracking                                 │
│ • Retry logic (3 attempts)                                     │
│ • Token usage monitoring                                        │
│ • Similarity calculations                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Supabase Vector Service
```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE VECTOR SERVICE                      │
├─────────────────────────────────────────────────────────────────┤
│ Database: PostgreSQL with pgvector extension                    │
│ Table: embeddings (content_id, embedding, metadata)            │
│                                                                 │
│ Features:                                                       │
│ • Vector similarity search                                      │
│ • Cosine similarity calculations                                │
│ • Batch indexing (100 items)                                   │
│ • Metadata storage                                              │
│ • Query embedding generation                                    │
│ • Rate limiting (500ms between batches)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Pipeline Orchestrator
```
┌─────────────────────────────────────────────────────────────────┐
│                    PIPELINE ORCHESTRATOR                        │
├─────────────────────────────────────────────────────────────────┤
│ Purpose: Coordinate entire ETL process                          │
│                                                                 │
│ Features:                                                       │
│ • Service initialization                                        │
│ • Cron scheduling                                               │
│ • Statistics and monitoring                                     │
│ • Error handling and recovery                                   │
│ • Health checks                                                 │
│ • Resource cleanup                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

```
1. REDDIT SCRAPING
   ┌─────────────┐
   │ Reddit API  │ ──┐
   └─────────────┘   │
                     ▼
   ┌─────────────────────────────────┐
   │ Raw Posts & Comments            │
   │ • Title, content, author        │
   │ • Score, comment count          │
   │ • Timestamps, metadata          │
   └─────────────────────────────────┘

2. TEXT PROCESSING
                     ▼
   ┌─────────────────────────────────┐
   │ Cleaned & Processed Text        │
   │ • Removed Reddit formatting     │
   │ • Extracted keywords           │
   │ • Identified entities           │
   │ • Calculated statistics         │
   └─────────────────────────────────┘

3. DATABASE STORAGE
                     ▼
   ┌─────────────────────────────────┐
   │ PostgreSQL Tables              │
   │ • posts (structured data)       │
   │ • sentiment_analysis            │
   │ • metadata & relationships      │
   └─────────────────────────────────┘

4. EMBEDDING GENERATION
                     ▼
   ┌─────────────────────────────────┐
   │ OpenAI Embeddings               │
   │ • 1536-dimensional vectors      │
   │ • Cost tracking                 │
   │ • Token usage monitoring        │
   └─────────────────────────────────┘

5. VECTOR INDEXING
                     ▼
   ┌─────────────────────────────────┐
   │ Supabase Vector Database        │
   │ • pgvector storage              │
   │ • Similarity search ready       │
   │ • Metadata preserved            │
   └─────────────────────────────────┘
```

## Performance Characteristics

### Rate Limits
- **Reddit API**: 1 second between requests
- **OpenAI API**: 1 second between batches  
- **Supabase**: 500ms between batches

### Batch Sizes
- **Text Processing**: 100 items per batch
- **Embeddings**: 100 items per batch
- **Indexing**: 100 items per batch

### Memory Usage
- **Reddit Scraper**: ~20MB
- **Text Cleaner**: ~50MB (with batch processing)
- **Embeddings Service**: ~100MB (with OpenAI client)
- **Supabase Service**: ~30MB

### Processing Times
- **Reddit Scraping**: ~2-5 seconds per 100 posts
- **Text Cleaning**: ~1-2 seconds per 100 items
- **Embedding Generation**: ~10-30 seconds per 100 items
- **Vector Indexing**: ~2-5 seconds per 100 items

## Error Handling Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        ERROR HANDLING                          │
├─────────────────────────────────────────────────────────────────┤
│ Level 1: Service Level                                          │
│ • Retry logic with exponential backoff                          │
│ • Graceful degradation                                          │
│ • Partial failure handling                                      │
│                                                                 │
│ Level 2: Pipeline Level                                         │
│ • Continue processing on failures                               │
│ • Skip invalid items                                            │
│ • Maintain data consistency                                     │
│                                                                 │
│ Level 3: System Level                                            │
│ • Health checks and monitoring                                  │
│ • Alert thresholds                                              │
│ • Resource cleanup                                              │
└─────────────────────────────────────────────────────────────────┘
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────────────┐
│                      MONITORING STACK                          │
├─────────────────────────────────────────────────────────────────┤
│ Metrics:                                                         │
│ • Total scraped items                                           │
│ • Processing success/failure rates                              │
│ • Embedding generation costs                                     │
│ • Indexing performance                                          │
│ • Pipeline run history                                          │
│                                                                 │
│ Logging:                                                        │
│ • Structured JSON logging                                       │
│ • Error tracking                                                │
│ • Performance metrics                                           │
│ • Debug information                                             │
│                                                                 │
│ Health Checks:                                                  │
│ • Service connectivity                                           │
│ • Database health                                               │
│ • API rate limits                                               │
│ • Error rates                                                   │
└─────────────────────────────────────────────────────────────────┘
```
