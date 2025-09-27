/**
 * API UTILITY LIBRARY - FRONTEND HTTP CLIENT CONFIGURATION
 * 
 * Purpose: Centralized HTTP client for all backend API communication
 * 
 * Key Responsibilities:
 * - Configures axios instance with base URL and default settings
 * - Handles environment-specific API endpoint configuration
 * - Provides request/response interceptors for logging and debugging
 * - Sets timeout and default headers for all API calls
 * - Manages error handling and response transformation
 * 
 * Configuration:
 * - Development: http://localhost:3001/api
 * - Production: Railway deployment URL/api
 * - Timeout: 5000ms for all requests
 * - Content-Type: application/json by default
 * 
 * Features:
 * - Request Logging: Logs all outgoing API calls with method, URL, params
 * - Response Logging: Logs successful responses and error details
 * - Error Handling: Standardized error format for frontend consumption
 * - Environment Awareness: Automatic URL switching based on deployment
 * 
 * Dependencies:
 * - Axios for HTTP client functionality
 * - Environment variables for API URL configuration
 * - Console logging for development debugging
 * 
 * Impact on System:
 * - Changes here affect all frontend-backend communication
 * - URL configuration changes impact deployment connectivity
 * - Timeout changes affect user experience during slow requests
 * - Interceptor changes impact debugging and monitoring
 * - Error handling changes affect user feedback and error recovery
 */

import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'

console.log('🔧 API Configuration:', {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  API_BASE_URL: API_BASE_URL,
  finalBaseURL: `${API_BASE_URL}/api`
})

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log('🚀 API Request:', {
      method: config.method?.toUpperCase(),
      url: (config.baseURL || '') + (config.url || ''),
      params: config.params,
      data: config.data
    })
    return config
  },
  (error) => {
    console.error('❌ Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    })
    return response
  },
  (error) => {
    const baseURL = error.config?.baseURL || ''
    const url = error.config?.url || ''
    console.error('❌ API Error:', {
      message: error.message,
      status: error.response?.status,
      baseURL,
      url,
      fullUrl: `${baseURL}${url}`,
      data: error.response?.data,
      config: error.config
    })
    return Promise.reject(error)
  }
)
