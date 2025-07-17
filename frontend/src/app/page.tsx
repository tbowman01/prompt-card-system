'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'

interface HealthStatus {
  status: string
  services: {
    database: string
    ollama: {
      url: string
      status: string
    }
  }
}

export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHealthStatus = async () => {
      try {
        const response = await apiClient.get('/health')
        setHealthStatus(response.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch health status')
      } finally {
        setLoading(false)
      }
    }

    fetchHealthStatus()
  }, [])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome to Prompt Card System
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          Test-driven prompt development with local LLM integration
        </p>
      </div>

      {/* System Status */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Status</h2>
        {loading && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Checking system health...</p>
          </div>
        )}
        {error && (
          <div className="text-center text-red-600">
            <p>Error: {error}</p>
          </div>
        )}
        {healthStatus && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                healthStatus.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium">
                API Status: {healthStatus.status}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                healthStatus.services.database === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium">
                Database: {healthStatus.services.database}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                healthStatus.services.ollama.status === 'configured' ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium">
                Ollama: {healthStatus.services.ollama.status}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/prompt-cards" className="card hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Manage Prompt Cards
          </h3>
          <p className="text-gray-600">
            Create, edit, and organize your prompt cards for testing
          </p>
        </Link>
        
        <Link href="/prompt-cards/new" className="card hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Create New Card
          </h3>
          <p className="text-gray-600">
            Start building a new prompt card with test cases
          </p>
        </Link>
        
        <Link href="/yaml" className="card hover:shadow-md transition-shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Import/Export YAML
          </h3>
          <p className="text-gray-600">
            Import existing Promptfoo configurations or export your cards
          </p>
        </Link>
      </div>

      {/* Features Overview */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
            <div>
              <h3 className="font-medium text-gray-900">Prompt Card Management</h3>
              <p className="text-sm text-gray-600">Create and organize prompt templates with variables</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
            <div>
              <h3 className="font-medium text-gray-900">Test Case Creation</h3>
              <p className="text-sm text-gray-600">Define test cases with input variables and assertions</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
            <div>
              <h3 className="font-medium text-gray-900">Local LLM Integration</h3>
              <p className="text-sm text-gray-600">Test prompts with local Ollama models</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
            <div>
              <h3 className="font-medium text-gray-900">YAML Import/Export</h3>
              <p className="text-sm text-gray-600">Compatible with Promptfoo configuration format</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}