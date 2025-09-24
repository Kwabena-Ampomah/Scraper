'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export default function TestPage() {
  const [result, setResult] = useState('Loading...')
  const [error, setError] = useState(null)

  useEffect(() => {
    const testAPI = async () => {
      try {
        console.log('Testing API connection...')
        console.log('API Base URL:', process.env.NEXT_PUBLIC_API_BASE_URL)
        const response = await api.get('/health')
        console.log('API Response:', response.data)
        setResult(JSON.stringify(response.data, null, 2))
      } catch (err: any) {
        console.error('API Error:', err)
        setError(err.message)
        setResult(`Error: ${err.message}\n\nDetails: ${JSON.stringify(err.response?.data || err, null, 2)}`)
      }
    }

    testAPI()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Test</h1>
      <div className="bg-gray-100 p-4 rounded">
        <pre>{result}</pre>
        {error && <div className="text-red-500 mt-2">Error: {error}</div>}
      </div>
    </div>
  )
}
