/**
 * PAIN POINTS ANALYSIS COMPONENT - USER PROBLEM IDENTIFICATION
 * 
 * Purpose: Visualizes and analyzes user-reported problems and negative experiences
 * 
 * Key Responsibilities:
 * - Displays identified pain points from backend analytics
 * - Shows frequency and category breakdown of user problems
 * - Provides interactive charts for pain point visualization
 * - Handles empty state when no pain points are detected
 * - Renders severity indicators and problem categorization
 * 
 * Data Structure Expected:
 * - text: Description of the pain point or problem
 * - frequency: Number of times this issue was mentioned
 * - category: Classification of the problem type (e.g., "user_experience")
 * 
 * Visualization Features:
 * - Bar chart showing pain point frequencies
 * - Category-based color coding and icons
 * - Summary cards with key metrics
 * - Problem severity indicators
 * 
 * Dependencies:
 * - Backend /api/insights/pain-points endpoint
 * - Recharts library for data visualization
 * - Lucide icons for UI elements
 * - Parent component for data fetching
 * 
 * Impact on System:
 * - Changes here affect how user problems are visualized
 * - Data structure changes require backend API alignment
 * - New categorization logic needs backend support
 * - Performance optimizations improve dashboard loading
 * - UI improvements enhance problem identification workflow
 */

'use client'

import { 
  AlertTriangle, 
  TrendingDown, 
  MessageSquare, 
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
  text: string
  frequency: number
  category: string
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

  // Simple severity determination based on frequency
  const getSeverity = (frequency: number) => {
    if (frequency >= 10) return 'high'
    if (frequency >= 5) return 'medium' 
    return 'low'
  }

  const getSeverityColor = (frequency: number) => {
    const severity = getSeverity(frequency)
    switch (severity) {
      case 'high': return 'border-red-200 bg-red-50'
      case 'medium': return 'border-orange-200 bg-orange-50' 
      case 'low': return 'border-yellow-200 bg-yellow-50'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  const getSeverityIcon = (frequency: number) => {
    const severity = getSeverity(frequency)
    switch (severity) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'medium': return <TrendingDown className="h-4 w-4 text-orange-600" />
      case 'low': return <TrendingDown className="h-4 w-4 text-yellow-600" />
      default: return <TrendingDown className="h-4 w-4 text-gray-600" />
    }
  }

  // Chart data using frequency
  const chartData = painPoints.slice(0, 8).map(point => ({
    name: point.text.length > 30 ? point.text.substring(0, 30) + '...' : point.text,
    frequency: point.frequency || 0
  }))

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-gray-900">Pain Points Analysis</h2>
        <p className="text-sm text-gray-600">Issues identified from user feedback</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Frequency Chart */}
        <div className="lg:col-span-1">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Pain Points by Frequency</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} fontSize={10} />
              <Tooltip 
                formatter={(value: any) => [value, 'Frequency']}
                labelFormatter={(label: any) => `Issue: ${label}`}
              />
              <Bar dataKey="frequency" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="lg:col-span-1">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-gray-600">Total Issues</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{painPoints.length}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-gray-600">Total Reports</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {painPoints.reduce((sum, point) => sum + (point.frequency || 0), 0)}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-gray-600">Top Category</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {painPoints[0]?.category || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pain Points List */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900">Detailed Issues</h3>
        <div className="grid gap-4">
          {painPoints.slice(0, 10).map((point, index) => (
            <div
              key={index}
              className={`border rounded-lg p-4 ${getSeverityColor(point.frequency)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getSeverityIcon(point.frequency)}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{point.text}</h4>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100">
                        {getSeverity(point.frequency)}
                      </span>
                      <span>Category: {point.category}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end space-y-1 text-xs text-gray-600">
                  <div className="flex items-center space-x-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>{point.frequency} reports</span>
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
