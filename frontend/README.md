# User Feedback Intelligence Dashboard

A modern Next.js dashboard for analyzing user sentiment and insights across Reddit, Twitter, and other platforms.

## 🚀 Features

- **Real-time Sentiment Analysis**: Visualize user sentiment with interactive charts
- **Thematic Clustering**: Group feedback into meaningful themes and clusters
- **Pain Points Analysis**: Identify critical issues with severity levels
- **Feature Requests**: Track user-requested features by priority
- **Advanced Filtering**: Filter by platform, timeframe, sentiment, and product
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## 📋 Prerequisites

- Node.js 18+
- Backend API running on port 3001

## 🛠 Installation

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   # Create .env.local file
   echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001" > .env.local
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎨 Components

### Dashboard Layout
- **Header**: Navigation and refresh controls
- **Main Content**: Sentiment overview, clusters, pain points, feature requests
- **Sidebar**: Filter panel with platform/timeframe/sentiment filters

### Sentiment Overview
- **Key Metrics**: Total posts, average sentiment score
- **Pie Chart**: Sentiment distribution (positive/negative/neutral)
- **Bar Chart**: Detailed sentiment breakdown

### Theme Clusters
- **Chart View**: Bar chart showing cluster sizes
- **List View**: Expandable clusters with sample posts
- **Keywords**: Associated keywords for each theme
- **Confidence Scores**: Reliability of clustering

### Pain Points Analysis
- **Severity Levels**: Critical, High, Medium, Low
- **Frequency Charts**: Most mentioned issues
- **Sample Issues**: Real user feedback examples
- **Impact Metrics**: Posts, comments, mentions

### Feature Requests
- **Priority Levels**: High, Medium, Low
- **Request Frequency**: Most requested features
- **User Examples**: Sample feature requests
- **Sentiment Analysis**: User enthusiasm for features

## 🔧 Configuration

### Environment Variables
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### API Integration
The dashboard connects to your backend API endpoints:
- `/api/insights/dashboard/:productId` - Dashboard data
- `/api/insights/clusters/:productId` - Theme clusters
- `/api/insights/pain-points/:productId` - Pain points
- `/api/insights/feature-requests/:productId` - Feature requests

## 📱 Responsive Design

- **Desktop**: Full dashboard with sidebar
- **Tablet**: Stacked layout with collapsible sidebar
- **Mobile**: Single column layout with touch-friendly controls

## 🎯 Usage

1. **Select Product**: Choose from available products (default: WHOOP 5.0)
2. **Filter Data**: Use sidebar filters to narrow down results
3. **View Insights**: Explore sentiment, clusters, pain points, and feature requests
4. **Refresh Data**: Click refresh button to get latest data
5. **Expand Details**: Click on clusters to see sample posts

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm start
```

### Docker Deployment
```bash
# Build image
docker build -t feedback-dashboard .

# Run container
docker run -p 3000:3000 feedback-dashboard
```

## 🧪 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Tech Stack
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Lucide React** - Icons
- **Axios** - API client

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - see LICENSE file for details
