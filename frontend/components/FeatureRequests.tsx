'use client'

import { 
  Lightbulb, 
  TrendingUp, 
  MessageSquare, 
  Users,
  BarChart3,
  Star
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'

interface FeatureRequest {
  keyword: string
  frequency: number
  averageSentiment: number
  postCount: number
  sampleTitles: string[]
  priority: 'low' | 'medium' | 'high'
}

interface FeatureRequestsProps {
  featureRequests: FeatureRequest[]
}

export function FeatureRequests({ featureRequests }: FeatureRequestsProps) {
  console.log('💡 FeatureRequests rendering with featureRequests:', featureRequests)
  
  if (!featureRequests || featureRequests.length === 0) {
    console.log('💡 FeatureRequests: No feature requests identified')
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Feature Requests</h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">No feature requests identified</div>
        </div>
      </div>
    )
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-green-100 text-green-800 border-green-200'
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <Star className="h-4 w-4 text-green-600" />
      case 'medium': return <TrendingUp className="h-4 w-4 text-blue-600" />
      case 'low': return <TrendingUp className="h-4 w-4 text-gray-600" />
      default: return <TrendingUp className="h-4 w-4 text-gray-600" />
    }
  }

  const chartData = featureRequests.slice(0, 10).map(request => ({
    keyword: request.keyword,
    frequency: request.frequency || 0,
    priority: request.priority,
    sentiment: request.averageSentiment || 0
  }))

  const priorityCounts = featureRequests.reduce((acc, request) => {
    acc[request.priority] = (acc[request.priority] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const priorityData = Object.entries(priorityCounts).map(([priority, count]) => ({
    priority: priority.charAt(0).toUpperCase() + priority.slice(1),
    count,
    color: priority === 'high' ? '#22c55e' : 
           priority === 'medium' ? '#3b82f6' : '#6b7280'
  }))

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-gray-900">Feature Requests</h2>
        <p className="text-sm text-gray-600">User-requested features and improvements</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Priority Overview */}
        <div className="lg:col-span-1">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Priority Distribution</h3>
          <div className="space-y-3">
            {priorityData.map((item) => (
              <div key={item.priority} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-600">{item.priority}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Frequency Chart */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Top Feature Requests by Frequency</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="keyword" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  value, 
                  name === 'frequency' ? 'Mentions' : 'Sentiment'
                ]}
              />
              <Bar dataKey="frequency" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Requests List */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900">Detailed Feature Requests</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {featureRequests.map((request, index) => (
            <div 
              key={request.keyword}
              className={`border rounded-lg p-4 ${getPriorityColor(request.priority)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getPriorityIcon(request.priority)}
                  <h4 className="font-medium">{request.keyword}</h4>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-white/50">
                  {request.priority}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>{request.postCount} posts</span>
                </div>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>{request.frequency} mentions</span>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>{(request.averageSentiment || 0).toFixed(2)} sentiment</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>{request.postCount} users</span>
                </div>
              </div>

              {request.sampleTitles.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/20">
                  <p className="text-xs font-medium mb-2">Sample Requests:</p>
                  <div className="space-y-1">
                    {request.sampleTitles.slice(0, 2).map((title, idx) => (
                      <p key={idx} className="text-xs line-clamp-2">
                        "{title}"
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
