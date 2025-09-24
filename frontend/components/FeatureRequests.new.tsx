'use client'

import { 
  Lightbulb, 
  TrendingUp, 
  Star,
  AlertTriangle
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
  text: string
  frequency: number
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

  // Prepare data for chart
  const chartData = featureRequests.map(request => ({
    name: request.text.substring(0, 30) + (request.text.length > 30 ? '...' : ''),
    frequency: request.frequency,
    priority: request.priority
  }))

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="w-4 h-4" />
      case 'medium': return <Star className="w-4 h-4" />
      case 'low': return <TrendingUp className="w-4 h-4" />
      default: return <Lightbulb className="w-4 h-4" />
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5" />
          Feature Requests
        </h2>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Request Frequency</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={100}
                fontSize={12}
              />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [value, 'Frequency']}
                labelFormatter={(label) => `Request: ${label}`}
              />
              <Bar dataKey="frequency" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Feature Requests List */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700">Top Feature Requests</h3>
        <div className="space-y-3">
          {featureRequests.slice(0, 5).map((request, index) => (
            <div 
              key={index}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getPriorityIcon(request.priority)}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(request.priority)}`}>
                      {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)} Priority
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 mb-1">{request.text}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {request.frequency} mentions
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
