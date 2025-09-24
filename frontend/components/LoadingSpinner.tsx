'use client'

export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="loading-spinner"></div>
      <p className="text-gray-600">Loading dashboard...</p>
    </div>
  )
}
