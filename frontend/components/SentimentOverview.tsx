'use client'

import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Users, MessageSquare } from 'lucide-react'

interface SentimentData {
  totalPosts: number
  averageSentiment: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  positivePercentage: string
  negativePercentage: string
  neutralPercentage: string
}

interface SentimentOverviewProps {
  data: SentimentData | undefined
}

export function SentimentOverview({ data }: SentimentOverviewProps) {
  console.log('📊 SentimentOverview rendering with data:', data)
  
  if (!data) {
    console.log('📊 SentimentOverview: No data available')
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Sentiment Overview</h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">No data available</div>
        </div>
      </div>
    )
  }

  const sentimentPieData = [
    { name: 'Positive', value: data.positiveCount || 0, color: '#22c55e' },
    { name: 'Negative', value: data.negativeCount || 0, color: '#ef4444' },
    { name: 'Neutral', value: data.neutralCount || 0, color: '#6b7280' }
  ]

  const sentimentTrendData = [
    { name: 'Positive', percentage: parseFloat(data.positivePercentage || '0'), count: data.positiveCount || 0 },
    { name: 'Negative', percentage: parseFloat(data.negativePercentage || '0'), count: data.negativeCount || 0 },
    { name: 'Neutral', percentage: parseFloat(data.neutralPercentage || '0'), count: data.neutralCount || 0 }
  ]

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0.1) return <TrendingUp className="h-5 w-5 text-success-600" />
    if (sentiment < -0.1) return <TrendingDown className="h-5 w-5 text-danger-600" />
    return <Minus className="h-5 w-5 text-gray-600" />
  }

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.1) return 'text-success-600'
    if (sentiment < -0.1) return 'text-danger-600'
    return 'text-gray-600'
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-gray-900">Sentiment Overview</h2>
        <p className="text-sm text-gray-600">Analysis of user feedback sentiment</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Key Metrics */}
        <div className="space-y-4">
          <div className="metric-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900">{data.totalPosts}</p>
              </div>
              <Users className="h-8 w-8 text-primary-600" />
            </div>
          </div>

          <div className="metric-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Sentiment</p>
                <div className="flex items-center space-x-2">
                  {getSentimentIcon(data.averageSentiment)}
                  <p className={`text-2xl font-bold ${getSentimentColor(data.averageSentiment || 0)}`}>
                    {(data.averageSentiment || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <MessageSquare className="h-8 w-8 text-primary-600" />
            </div>
          </div>
        </div>

        {/* Sentiment Distribution Pie Chart */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Sentiment Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={sentimentPieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {sentimentPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="flex justify-center space-x-6 mt-4">
            {sentimentPieData.map((item) => (
              <div key={item.name} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sentiment Breakdown Bar Chart */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Sentiment Breakdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sentimentTrendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [
                `${value}${name === 'percentage' ? '%' : ''}`, 
                name === 'percentage' ? 'Percentage' : 'Count'
              ]}
            />
            <Bar dataKey="percentage" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
