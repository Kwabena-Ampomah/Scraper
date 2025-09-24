/**
 * Reddit Scraper Service
 * 
 * Handles Reddit data extraction using Reddit API
 * Supports multiple search terms and subreddits
 * Includes rate limiting and error handling
 */

const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class RedditScraper {
  constructor() {
    this.baseUrl = 'https://www.reddit.com';
    this.userAgent = 'FeedbackIntelligenceBot/1.0';
    this.rateLimitDelay = 1000; // 1 second between requests
  }

  /**
   * Scrape Reddit posts for given search terms
   */
  async scrapePosts(config = {}) {
    const {
      subreddit = 'whoop',
      searchTerms = ['WHOOP 5.0'],
      limit = 100,
      timeframe = 'month',
      sort = 'new'
    } = config;

    logger.info('🔍 Starting Reddit scraping...', { 
      subreddit, 
      searchTerms, 
      limit, 
      timeframe 
    });

    const allPosts = [];

    try {
      for (const term of searchTerms) {
        logger.info(`📊 Scraping posts for term: ${term}`);
        
        const posts = await this.fetchPostsForTerm({
          subreddit,
          term,
          limit: Math.min(limit, 100), // Reddit API limit
          timeframe,
          sort
        });

        allPosts.push(...posts);
        
        // Rate limiting
        if (searchTerms.indexOf(term) < searchTerms.length - 1) {
          await this.delay(this.rateLimitDelay);
        }
      }

      logger.info(`✅ Scraped ${allPosts.length} total posts`);
      return allPosts;

    } catch (error) {
      logger.error('❌ Reddit scraping failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch posts for a specific search term
   */
  async fetchPostsForTerm({ subreddit, term, limit, timeframe, sort }) {
    try {
      const response = await axios.get(`${this.baseUrl}/r/${subreddit}/search.json`, {
        params: {
          q: term,
          sort,
          limit,
          t: timeframe,
          raw_json: 1
        },
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: 30000
      });

      if (!response.data || !response.data.data || !response.data.data.children) {
        throw new Error('Invalid Reddit API response structure');
      }

      const posts = response.data.data.children.map(child => {
        const data = child.data;
        
        return {
          id: data.id,
          title: data.title || '',
          content: data.selftext || '',
          author: data.author || 'unknown',
          url: `https://reddit.com${data.permalink}`,
          score: data.score || 0,
          commentCount: data.num_comments || 0,
          createdAt: new Date(data.created_utc * 1000),
          subreddit: data.subreddit,
          searchTerm: term,
          platform: 'reddit',
          upvoteRatio: data.upvote_ratio || 0,
          isSelfPost: data.is_self || false,
          domain: data.domain || '',
          rawData: data
        };
      });

      logger.info(`📊 Found ${posts.length} posts for term: ${term}`);
      return posts;

    } catch (error) {
      logger.error(`❌ Failed to fetch posts for term: ${term}`, { 
        error: error.message,
        subreddit,
        term 
      });
      throw error;
    }
  }

  /**
   * Scrape comments for a specific post
   */
  async scrapeComments(postId, subreddit, limit = 50) {
    try {
      const response = await axios.get(`${this.baseUrl}/r/${subreddit}/comments/${postId}.json`, {
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: 30000
      });

      if (!response.data || !response.data[1] || !response.data[1].data) {
        return [];
      }

      const comments = [];
      const processComment = (comment, depth = 0) => {
        if (!comment.data || comment.data.body === '[deleted]' || comment.data.body === '[removed]') {
          return;
        }

        comments.push({
          id: comment.data.id,
          postId: postId,
          content: comment.data.body,
          author: comment.data.author,
          score: comment.data.score || 0,
          createdAt: new Date(comment.data.created_utc * 1000),
          depth,
          parentId: comment.data.parent_id,
          platform: 'reddit'
        });

        // Process replies
        if (comment.data.replies && comment.data.replies.data) {
          comment.data.replies.data.children.forEach(reply => {
            processComment(reply, depth + 1);
          });
        }
      };

      response.data[1].data.children.forEach(comment => {
        processComment(comment);
      });

      logger.info(`📊 Scraped ${comments.length} comments for post: ${postId}`);
      return comments.slice(0, limit);

    } catch (error) {
      logger.error(`❌ Failed to scrape comments for post: ${postId}`, { 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Get subreddit information
   */
  async getSubredditInfo(subreddit) {
    try {
      const response = await axios.get(`${this.baseUrl}/r/${subreddit}/about.json`, {
        headers: {
          'User-Agent': this.userAgent
        },
        timeout: 10000
      });

      const data = response.data.data;
      
      return {
        name: data.display_name,
        title: data.title,
        description: data.public_description,
        subscribers: data.subscribers,
        activeUsers: data.active_user_count,
        created: new Date(data.created_utc * 1000),
        language: data.lang,
        over18: data.over18
      };

    } catch (error) {
      logger.error(`❌ Failed to get subreddit info: ${subreddit}`, { 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Search across multiple subreddits
   */
  async searchMultipleSubreddits(subreddits, searchTerms, config = {}) {
    const allResults = [];

    for (const subreddit of subreddits) {
      try {
        logger.info(`🔍 Searching subreddit: ${subreddit}`);
        
        const posts = await this.scrapePosts({
          subreddit,
          searchTerms,
          ...config
        });

        allResults.push(...posts);
        
        // Rate limiting between subreddits
        if (subreddits.indexOf(subreddit) < subreddits.length - 1) {
          await this.delay(this.rateLimitDelay * 2);
        }

      } catch (error) {
        logger.error(`❌ Failed to search subreddit: ${subreddit}`, { 
          error: error.message 
        });
        // Continue with other subreddits
      }
    }

    logger.info(`✅ Searched ${subreddits.length} subreddits, found ${allResults.length} posts`);
    return allResults;
  }

  /**
   * Utility function to add delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate Reddit API response
   */
  validateResponse(response) {
    if (!response || !response.data) {
      throw new Error('Empty response from Reddit API');
    }

    if (response.data.error) {
      throw new Error(`Reddit API error: ${response.data.error}`);
    }

    return true;
  }
}

module.exports = RedditScraper;
