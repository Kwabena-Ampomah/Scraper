# 🤖 Automated Reddit Search Guide

## 🎯 **Current Status: READY FOR AUTOMATION!**

Your system is **already set up** to search real Reddit posts automatically! Here's how to use it:

## 🚀 **Automation Options**

### **Option 1: Manual API Triggers (Immediate)**
```bash
# Run a single WHOOP 5.0 search
curl -X POST http://localhost:3001/api/search-reddit/run/whoop5

# Run custom search
curl -X POST http://localhost:3001/api/search-reddit/run \
  -H "Content-Type: application/json" \
  -d '{
    "subreddit": "whoop",
    "searchTerms": ["WHOOP 5.0", "new WHOOP"],
    "limit": 20,
    "timeframe": "day"
  }'
```

### **Option 2: Scheduled Automation (Production)**
```bash
# Start the automated scheduler
cd backend
node scripts/startScheduler.js
```

This will automatically search for:
- **WHOOP 5.0 posts** every 2 hours
- **General WHOOP posts** every 4 hours  
- **Fitness tracking posts** every 6 hours
- **Daily comprehensive search** at 9 AM
- **Weekly deep dive** every Monday at 10 AM

### **Option 3: One-Time Search**
```bash
# Run a single search manually
cd backend
node scripts/searchReddit.js
```

## 📊 **What Gets Searched**

### **Real Reddit Data Sources:**
- ✅ **r/whoop** - WHOOP-specific discussions
- ✅ **r/fitness** - General fitness tracking
- ✅ **r/sleep** - Sleep tracking discussions
- ✅ **Competitor analysis** - Oura, Fitbit, Garmin, Apple Watch

### **Search Terms:**
- **WHOOP 5.0**: "WHOOP 5.0", "new WHOOP", "WHOOP 5"
- **Issues**: "WHOOP problem", "WHOOP issue", "WHOOP bug"
- **Features**: "WHOOP feature", "WHOOP request", "WHOOP suggestion"
- **General**: "WHOOP", "whoop band", "whoop strap"

## 🔄 **Automated Processing Pipeline**

When Reddit posts are found, they automatically go through:

1. **📥 Scraping** - Extract post content, comments, metadata
2. **🧹 Text Cleaning** - Remove noise, extract keywords
3. **💭 Sentiment Analysis** - Analyze positive/negative sentiment
4. **🤖 AI Embeddings** - Create vector representations
5. **💾 Database Storage** - Store in PostgreSQL
6. **🔍 Vector Indexing** - Index in Supabase for similarity search

## 📈 **Real-Time Dashboard Updates**

The frontend dashboard will show:
- **Live sentiment scores** from real Reddit posts
- **Thematic clusters** of real user feedback
- **Pain points** identified from real complaints
- **Feature requests** from real user suggestions

## ⚙️ **Configuration Options**

### **Search Frequencies:**
- **High Frequency**: Every 2 hours (WHOOP 5.0)
- **Medium Frequency**: Every 4 hours (General WHOOP)
- **Low Frequency**: Every 6 hours (Issues & Features)
- **Daily**: 9 AM (Comprehensive search)
- **Weekly**: Monday 10 AM (Deep dive + competitors)

### **Search Limits:**
- **Small searches**: 10-15 posts
- **Medium searches**: 20-25 posts  
- **Large searches**: 50-100 posts

### **Time Ranges:**
- **hour** - Last hour
- **day** - Last 24 hours
- **week** - Last 7 days
- **month** - Last 30 days
- **year** - Last 365 days
- **all** - All time

## 🎛️ **API Endpoints**

### **Get Available Configurations**
```bash
GET /api/search-reddit/configurations
```

### **Run Predefined Search**
```bash
POST /api/search-reddit/run/whoop5
POST /api/search-reddit/run/whoopGeneral
POST /api/search-reddit/run/whoopIssues
POST /api/search-reddit/run/whoopFeatures
```

### **Run Custom Search**
```bash
POST /api/search-reddit/run
{
  "subreddit": "whoop",
  "searchTerms": ["WHOOP 5.0"],
  "limit": 20,
  "timeframe": "day"
}
```

### **Schedule Recurring Search**
```bash
POST /api/search-reddit/schedule
{
  "configName": "whoop5",
  "cronExpression": "0 */2 * * *"
}
```

### **Get Pipeline Statistics**
```bash
GET /api/search-reddit/stats
```

## 🚀 **Quick Start Commands**

### **1. Test Single Search**
```bash
cd backend
node scripts/searchReddit.js
```

### **2. Start Automated Scheduler**
```bash
cd backend
node scripts/startScheduler.js
```

### **3. Check Pipeline Status**
```bash
curl http://localhost:3001/api/search-reddit/stats
```

## 📊 **Expected Results**

After running searches, you'll see:

```
✅ Scraped: 25 Reddit posts
✅ Processed: 25 text items
✅ Embedded: 25 vectors
✅ Indexed: 25 embeddings
```

## 🎯 **Next Steps**

1. **Test the system**: Run `node scripts/searchReddit.js`
2. **Start automation**: Run `node scripts/startScheduler.js`
3. **Monitor results**: Check the dashboard for real data
4. **Deploy to production**: Use Railway for backend, Vercel for frontend

## 🔧 **Troubleshooting**

### **No posts found?**
- Check Reddit API rate limits
- Verify subreddit exists and is accessible
- Try different search terms

### **Pipeline errors?**
- Check environment variables
- Verify database connections
- Check OpenAI API key

### **Scheduler not working?**
- Check cron expression format
- Verify node-cron installation
- Check logs for errors

---

## 🎉 **You're Ready!**

Your system is **fully configured** to automatically search real Reddit posts and process them into actionable insights. Just run the commands above to start! 🚀
