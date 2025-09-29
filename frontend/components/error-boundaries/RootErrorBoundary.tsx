"use client"

import React from 'react'
import { ErrorBoundary } from './ErrorBoundary'

interface RootErrorBoundaryProps {
  children: React.ReactNode
}

/**
 * Client-side error boundary wrapper for root layout
 */
export function RootErrorBoundary({ children }: RootErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-2xl font-bold text-red-600">
              Application Error
            </h1>
            <p className="text-gray-600">
              The application encountered an unexpected error.
              Please reload the page or try again later.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Application
            </button>
          </div>
        </div>
      }
      showDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </ErrorBoundary>
  )
}