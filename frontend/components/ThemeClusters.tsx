'use client'

import { useState } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  ChevronDown, 
  ChevronUp, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown,
  Hash,
  Minus
} from 'lucide-react'

interface Cluster {
  theme: string
  keywords: string[]
  postCount: number
  averageSentiment: number
  posts: Array<{
    id: string
    title: string
    content: string
    author: string
    score: number
    createdAt: string
    sentimentScore: number
    sentimentLabel: string
    platform: string
  }>
  confidence: number
}

interface ThemeClustersProps {
  clusters: Cluster[]
}

export function ThemeClusters({ clusters }: ThemeClustersProps) {
  console.log('🎯 ThemeClusters rendering with clusters:', clusters)
  
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart')

  if (!clusters || clusters.length === 0) {
    console.log('🎯 ThemeClusters: No clusters available')
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Thematic Clusters</h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">No clusters available</div>
        </div>
      </div>
    )
  }

  const chartData = clusters.map(cluster => ({
    theme: cluster.theme,
    postCount: cluster.postCount || 0,
    sentiment: cluster.averageSentiment || 0,
    confidence: cluster.confidence || 0
  }))

  const sentimentData = clusters.reduce((acc, cluster) => {
    const sentiment = (cluster.averageSentiment || 0) > 0.1 ? 'positive' : 
                     (cluster.averageSentiment || 0) < -0.1 ? 'negative' : 'neutral'
    acc[sentiment] = (acc[sentiment] || 0) + (cluster.postCount || 0)
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(sentimentData).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value,
    color: key === 'positive' ? '#22c55e' : key === 'negative' ? '#ef4444' : '#6b7280'
  }))

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0.1) return <TrendingUp className="h-4 w-4 text-success-600" />
    if (sentiment < -0.1) return <TrendingDown className="h-4 w-4 text-danger-600" />
    return <Minus className="h-4 w-4 text-gray-600" />
  }

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.1) return 'text-success-600'
    if (sentiment < -0.1) return 'text-danger-600'
    return 'text-gray-600'
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Thematic Clusters</h2>
            <p className="text-sm text-gray-600">Grouped themes from user feedback</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 text-sm rounded-lg ${
                viewMode === 'chart' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Chart
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-sm rounded-lg ${
                viewMode === 'list' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cluster Size Chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-4">Cluster Size by Theme</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="theme" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    value, 
                    name === 'postCount' ? 'Posts' : 'Sentiment'
                  ]}
                />
                <Bar dataKey="postCount" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sentiment Distribution */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-4">Sentiment Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, 'Posts']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {clusters.map((cluster) => (
            <div key={cluster.theme} className="border border-gray-200 rounded-lg p-4">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedCluster(
                  expandedCluster === cluster.theme ? null : cluster.theme
                )}
              >
                <div className="flex items-center space-x-3">
                  <Hash className="h-5 w-5 text-gray-400" />
                  <div>
                    <h3 className="font-medium text-gray-900">{cluster.theme}</h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{cluster.postCount} posts</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        {getSentimentIcon(cluster.averageSentiment)}
                        <span className={getSentimentColor(cluster.averageSentiment || 0)}>
                          {(cluster.averageSentiment || 0).toFixed(2)}
                        </span>
                      </span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                        {Math.round(cluster.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex flex-wrap gap-1">
                    {cluster.keywords.slice(0, 3).map((keyword) => (
                      <span 
                        key={keyword}
                        className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full"
                      >
                        {keyword}
                      </span>
                    ))}
                    {cluster.keywords.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{cluster.keywords.length - 3} more
                      </span>
                    )}
                  </div>
                  {expandedCluster === cluster.theme ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {expandedCluster === cluster.theme && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-900">Sample Posts:</h4>
                    {cluster.posts.slice(0, 3).map((post) => (
                      <div key={post.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {post.title}
                            </p>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {post.content}
                            </p>
                            <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                              <span>by {post.author}</span>
                              <span>•</span>
                              <span>{post.platform}</span>
                              <span>•</span>
                              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="ml-4 flex items-center space-x-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              post.sentimentLabel === 'positive' ? 'bg-success-100 text-success-700' :
                              post.sentimentLabel === 'negative' ? 'bg-danger-100 text-danger-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {post.sentimentLabel}
                            </span>
                            <span className="text-xs text-gray-500">
                              {post.score} votes
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
