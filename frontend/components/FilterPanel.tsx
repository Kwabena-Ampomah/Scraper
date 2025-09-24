'use client'

import { useState } from 'react'
import { 
  Filter, 
  Calendar, 
  Users, 
  MessageSquare,
  ChevronDown
} from 'lucide-react'

interface Filters {
  productId: string
  platform: string
  timeframe: string
  sentiment: string
}

interface FilterPanelProps {
  filters: Filters
  onFilterChange: (filters: Partial<Filters>) => void
}

export function FilterPanel({ filters, onFilterChange }: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const platforms = [
    { value: 'all', label: 'All Platforms' },
    { value: 'reddit', label: 'Reddit' },
    { value: 'twitter', label: 'Twitter' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' }
  ]

  const timeframes = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'all', label: 'All Time' }
  ]

  const sentiments = [
    { value: 'all', label: 'All Sentiments' },
    { value: 'positive', label: 'Positive Only' },
    { value: 'negative', label: 'Negative Only' },
    { value: 'neutral', label: 'Neutral Only' }
  ]

  const products = [
    { value: '0f0c4df2-a3e9-48e0-aa71-2f3462cb97d7', label: 'WHOOP 5.0' },
    { value: 'all', label: 'All Products' }
  ]

  return (
    <div className="card">
      <div 
        className="card-header cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          <ChevronDown 
            className={`h-5 w-5 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-6">
          {/* Product Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product
            </label>
            <select
              value={filters.productId}
              onChange={(e) => onFilterChange({ productId: e.target.value })}
              className="input-field"
            >
              {products.map((product) => (
                <option key={product.value} value={product.value}>
                  {product.label}
                </option>
              ))}
            </select>
          </div>

          {/* Platform Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Platform
            </label>
            <select
              value={filters.platform}
              onChange={(e) => onFilterChange({ platform: e.target.value })}
              className="input-field"
            >
              {platforms.map((platform) => (
                <option key={platform.value} value={platform.value}>
                  {platform.label}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timeframe
            </label>
            <select
              value={filters.timeframe}
              onChange={(e) => onFilterChange({ timeframe: e.target.value })}
              className="input-field"
            >
              {timeframes.map((timeframe) => (
                <option key={timeframe.value} value={timeframe.value}>
                  {timeframe.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sentiment Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sentiment
            </label>
            <select
              value={filters.sentiment}
              onChange={(e) => onFilterChange({ sentiment: e.target.value })}
              className="input-field"
            >
              {sentiments.map((sentiment) => (
                <option key={sentiment.value} value={sentiment.value}>
                  {sentiment.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Stats */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Total Posts</span>
                </div>
                <span className="font-medium text-gray-900">-</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Active Users</span>
                </div>
                <span className="font-medium text-gray-900">-</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Last Updated</span>
                </div>
                <span className="font-medium text-gray-900">-</span>
              </div>
            </div>
          </div>

          {/* Reset Filters */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={() => onFilterChange({
                productId: '0f0c4df2-a3e9-48e0-aa71-2f3462cb97d7',
                platform: 'all',
                timeframe: '30d',
                sentiment: 'all'
              })}
              className="w-full btn-secondary"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
