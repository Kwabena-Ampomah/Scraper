'use client'

import { 
  AlertTriangle, 
  TrendingDown, 
  MessageSquare, 
  Clock,
  Users,
  BarChart3
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

interface PainPoint {
  keyword: string
  frequency: number
  averageSentiment: number
  postCount: number
  commentCount: number
  sampleTitles: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface PainPointsAnalysisProps {
  painPoints: PainPoint[]
}

export function PainPointsAnalysis({ painPoints }: PainPointsAnalysisProps) {
  console.log('⚠️ PainPointsAnalysis rendering with painPoints:', painPoints)
  
  if (!painPoints || painPoints.length === 0) {
    console.log('⚠️ PainPointsAnalysis: No pain points identified')
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Pain Points Analysis</h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">No pain points identified</div>
        </div>
      </div>
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'high': return <TrendingDown className="h-4 w-4 text-orange-600" />
      case 'medium': return <TrendingDown className="h-4 w-4 text-yellow-600" />
      case 'low': return <TrendingDown className="h-4 w-4 text-gray-600" />
      default: return <TrendingDown className="h-4 w-4 text-gray-600" />
    }
  }

  const chartData = painPoints.slice(0, 10).map(point => ({
    keyword: point.keyword,
    frequency: point.frequency || 0,
    severity: point.severity,
    sentiment: point.averageSentiment || 0
  }))

  const severityCounts = painPoints.reduce((acc, point) => {
    acc[point.severity] = (acc[point.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const severityData = Object.entries(severityCounts).map(([severity, count]) => ({
    severity: severity.charAt(0).toUpperCase() + severity.slice(1),
    count,
    color: severity === 'critical' ? '#ef4444' : 
           severity === 'high' ? '#f97316' : 
           severity === 'medium' ? '#eab308' : '#6b7280'
  }))

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-gray-900">Pain Points Analysis</h2>
        <p className="text-sm text-gray-600">Critical issues identified from user feedback</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Severity Overview */}
        <div className="lg:col-span-1">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Severity Distribution</h3>
          <div className="space-y-3">
            {severityData.map((item) => (
              <div key={item.severity} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-600">{item.severity}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Frequency Chart */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Top Pain Points by Frequency</h3>
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
              <Bar dataKey="frequency" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pain Points List */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900">Detailed Pain Points</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {painPoints.map((point, index) => (
            <div 
              key={point.keyword}
              className={`border rounded-lg p-4 ${getSeverityColor(point.severity)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getSeverityIcon(point.severity)}
                  <h4 className="font-medium">{point.keyword}</h4>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-white/50">
                  {point.severity}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>{point.postCount} posts</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>{point.commentCount} comments</span>
                </div>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>{point.frequency} mentions</span>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingDown className="h-4 w-4" />
                  <span>{(point.averageSentiment || 0).toFixed(2)} sentiment</span>
                </div>
              </div>

              {point.sampleTitles.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/20">
                  <p className="text-xs font-medium mb-2">Sample Issues:</p>
                  <div className="space-y-1">
                    {point.sampleTitles.slice(0, 2).map((title, idx) => (
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
