'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3, 
  TrendingUp, 
  MessageSquare, 
  Filter, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  Target
} from 'lucide-react'
import { DashboardHeader } from '@/components/DashboardHeader'
import { SentimentOverview } from '@/components/SentimentOverview'
import { ThemeClusters } from '@/components/ThemeClusters'
import { PainPointsAnalysis } from '@/components/PainPointsAnalysis'
import { FeatureRequests } from '@/components/FeatureRequests'
import { FilterPanel } from '@/components/FilterPanel'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { api } from '@/lib/api'

interface DashboardData {
  sentiment: {
    totalPosts: number
    averageSentiment: number
    positiveCount: number
    negativeCount: number
    neutralCount: number
    positivePercentage: string
    negativePercentage: string
    neutralPercentage: string
  }
  topKeywords: Array<{
    keyword: string
    frequency: number
    averageSentiment: number
  }>
  platformBreakdown: Array<{
    platform: string
    postCount: number
    averageSentiment: number
  }>
  trends: Array<{
    date: string
    postCount: number
    averageSentiment: number
    positivePercentage: string
    negativePercentage: string
  }>
}

interface Filters {
  productId: string
  platform: string
  timeframe: string
  sentiment: string
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [clusters, setClusters] = useState([])
  const [painPoints, setPainPoints] = useState([])
  const [featureRequests, setFeatureRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({
    productId: '412ac63f-91be-4f26-bf66-2de7b9158126', // WHOOP 5.0 product ID - UPDATED
    platform: 'all',
    timeframe: '30d',
    sentiment: 'all'
  })

  const fetchDashboardData = async () => {
    try {
      console.log('🔍 Starting fetchDashboardData...')
      setLoading(true)
      setError(null)

      console.log('📊 Fetching dashboard data...')
      // Fetch dashboard data
      const dashboardResponse = await api.get(`/insights/dashboard/${filters.productId}`, {
        params: {
          platform: filters.platform || "all",
          timeframe: filters.timeframe || "30d"
        }
      })
      console.log('✅ Dashboard response:', dashboardResponse.data)

      console.log('🎯 Fetching clusters...')
      // Fetch clusters
      const clustersResponse = await api.get(`/insights/clusters/${filters.productId}`, {
        params: {
          platform: filters.platform || "all",
          timeframe: filters.timeframe || "30d"
        }
      })
      console.log('✅ Clusters response:', clustersResponse.data)

      console.log('⚠️ Fetching pain points...')
      // Fetch pain points
      const painPointsResponse = await api.get(`/insights/pain-points/${filters.productId}`, {
        params: {
          platform: filters.platform || "all",
          timeframe: filters.timeframe || "30d"
        }
      })
      console.log('✅ Pain points response:', painPointsResponse.data)

      console.log('💡 Fetching feature requests...')
      // Fetch feature requests
      const featureRequestsResponse = await api.get(`/insights/feature-requests/${filters.productId}`, {
        params: {
          platform: filters.platform || "all",
          timeframe: filters.timeframe || "30d"
        }
      })
      console.log('✅ Feature requests response:', featureRequestsResponse.data)

      console.log('📝 Setting state data...')
      setDashboardData(dashboardResponse.data.dashboard)
      setClusters(clustersResponse.data.clusters)
      setPainPoints(painPointsResponse.data.painPoints)
      setFeatureRequests(featureRequestsResponse.data.featureRequests)
      console.log('✅ All data set successfully!')

    } catch (err: any) {
      console.error('❌ Error fetching dashboard data:', err)
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config
      })
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('🔄 useEffect triggered with filters:', filters)
    fetchDashboardData()
  }, [filters])

  const handleFilterChange = (newFilters: Partial<Filters>) => {
    console.log('🔧 Filter change:', newFilters)
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered')
    fetchDashboardData()
  }

  console.log('🎨 Rendering dashboard with state:', {
    loading,
    error,
    hasDashboardData: !!dashboardData,
    hasClusters: !!clusters,
    hasPainPoints: !!painPoints,
    hasFeatureRequests: !!featureRequests
  })

  if (loading && !dashboardData) {
    console.log('⏳ Showing loading spinner')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    console.log('❌ Showing error state:', error)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={handleRefresh}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        onRefresh={handleRefresh}
        loading={loading}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Sentiment Overview */}
            <SentimentOverview data={dashboardData?.sentiment} />
            
            {/* Theme Clusters */}
            <ThemeClusters clusters={clusters} />
            
            {/* Pain Points Analysis */}
            <PainPointsAnalysis painPoints={painPoints} />
            
            {/* Feature Requests */}
            <FeatureRequests featureRequests={featureRequests} />
          </div>
          
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <FilterPanel 
              filters={filters}
              onFilterChange={handleFilterChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
