/**
 * Reddit Search Configurations
 * 
 * Predefined search strategies for different use cases
 */

const searchConfigurations = {
  // WHOOP-specific searches
  whoop5: {
    name: 'WHOOP 5.0 Posts',
    subreddit: 'whoop',
    searchTerms: ['WHOOP 5.0', 'WHOOP 5', 'new WHOOP', 'WHOOP 5.0 review'],
    limit: 20,
    timeframe: 'day',
    description: 'Latest posts about WHOOP 5.0'
  },

  whoopGeneral: {
    name: 'General WHOOP Posts',
    subreddit: 'whoop',
    searchTerms: ['WHOOP', 'whoop band', 'whoop strap', 'whoop device'],
    limit: 15,
    timeframe: 'day',
    description: 'General WHOOP-related posts'
  },

  whoopIssues: {
    name: 'WHOOP Issues & Complaints',
    subreddit: 'whoop',
    searchTerms: ['WHOOP problem', 'WHOOP issue', 'WHOOP bug', 'WHOOP not working', 'WHOOP broken'],
    limit: 10,
    timeframe: 'week',
    description: 'Posts about WHOOP issues and problems'
  },

  whoopFeatures: {
    name: 'WHOOP Feature Requests',
    subreddit: 'whoop',
    searchTerms: ['WHOOP feature', 'WHOOP request', 'WHOOP suggestion', 'WHOOP improvement'],
    limit: 10,
    timeframe: 'week',
    description: 'Posts requesting new WHOOP features'
  },

  // Fitness tracking searches
  fitnessTracking: {
    name: 'Fitness Tracking Posts',
    subreddit: 'fitness',
    searchTerms: ['fitness tracker', 'heart rate monitor', 'sleep tracking', 'activity tracker'],
    limit: 15,
    timeframe: 'day',
    description: 'General fitness tracking discussions'
  },

  sleepTracking: {
    name: 'Sleep Tracking Posts',
    subreddit: 'sleep',
    searchTerms: ['sleep tracking', 'sleep monitor', 'sleep data', 'sleep analysis'],
    limit: 10,
    timeframe: 'week',
    description: 'Posts about sleep tracking and analysis'
  },

  // Competitive analysis
  competitors: {
    name: 'Competitor Analysis',
    subreddit: 'fitness',
    searchTerms: ['Oura ring', 'Fitbit', 'Garmin', 'Apple Watch', 'Samsung Galaxy Watch'],
    limit: 20,
    timeframe: 'week',
    description: 'Posts about WHOOP competitors'
  },

  // Comprehensive daily search
  dailyComprehensive: {
    name: 'Daily Comprehensive Search',
    subreddit: 'whoop',
    searchTerms: [
      'WHOOP', 'whoop band', 'whoop strap', 'WHOOP 5.0', 
      'sleep tracking', 'heart rate', 'recovery', 'strain',
      'WHOOP app', 'WHOOP membership', 'WHOOP subscription'
    ],
    limit: 50,
    timeframe: 'day',
    description: 'Comprehensive daily WHOOP search'
  },

  // Weekly deep dive
  weeklyDeepDive: {
    name: 'Weekly Deep Dive',
    subreddit: 'whoop',
    searchTerms: [
      'WHOOP', 'whoop band', 'whoop strap', 'WHOOP 5.0',
      'sleep tracking', 'heart rate', 'recovery', 'strain',
      'WHOOP app', 'WHOOP membership', 'WHOOP subscription',
      'WHOOP problem', 'WHOOP issue', 'WHOOP bug',
      'WHOOP feature', 'WHOOP request', 'WHOOP suggestion'
    ],
    limit: 100,
    timeframe: 'week',
    description: 'Weekly comprehensive WHOOP analysis'
  }
};

// Schedule configurations
const scheduleConfigurations = {
  // High frequency searches (every 2 hours)
  highFrequency: {
    cron: '0 */2 * * *',
    searches: ['whoop5'],
    description: 'High frequency WHOOP 5.0 monitoring'
  },

  // Medium frequency searches (every 4 hours)
  mediumFrequency: {
    cron: '0 */4 * * *',
    searches: ['whoopGeneral', 'fitnessTracking'],
    description: 'Medium frequency general monitoring'
  },

  // Low frequency searches (every 6 hours)
  lowFrequency: {
    cron: '0 */6 * * *',
    searches: ['whoopIssues', 'whoopFeatures', 'sleepTracking'],
    description: 'Low frequency issue and feature monitoring'
  },

  // Daily comprehensive search
  daily: {
    cron: '0 9 * * *', // 9 AM daily
    searches: ['dailyComprehensive'],
    description: 'Daily comprehensive WHOOP analysis'
  },

  // Weekly deep dive
  weekly: {
    cron: '0 10 * * 1', // 10 AM every Monday
    searches: ['weeklyDeepDive', 'competitors'],
    description: 'Weekly deep dive and competitor analysis'
  }
};

module.exports = {
  searchConfigurations,
  scheduleConfigurations
};
