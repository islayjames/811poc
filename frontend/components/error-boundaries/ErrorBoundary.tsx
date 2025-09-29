"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, RefreshCw, Bug, Home } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  showDetails?: boolean
  isolateError?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

/**
 * React Error Boundary component that catches JavaScript errors anywhere in the child component tree
 * Provides graceful fallback UI and error recovery options
 */
export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null
  private prevResetKeys: Array<string | number> = []

  constructor(props: Props) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    }

    this.prevResetKeys = props.resetKeys || []
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props

    // Update state with error info
    this.setState({
      errorInfo
    })

    // Log error for debugging
    this.logError(error, errorInfo)

    // Call custom error handler if provided
    if (onError) {
      try {
        onError(error, errorInfo)
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError)
      }
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    // Reset error state if resetKeys have changed
    if (hasError && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== this.prevResetKeys[index]
      )

      if (hasResetKeyChanged) {
        this.prevResetKeys = resetKeys
        this.resetErrorBoundary()
      }
    }

    // Reset on any prop change if enabled
    if (hasError && resetOnPropsChange && prevProps !== this.props) {
      this.resetErrorBoundary()
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    const { errorId } = this.state

    // Enhanced error logging
    const errorDetails = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    }

    console.group(`🚨 React Error Boundary - ${errorId}`)
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)
    console.table(errorDetails)
    console.groupEnd()

    // In production, you might want to send this to an error reporting service
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      // errorReportingService.captureException(error, errorDetails)
    }
  }

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    })
  }

  private handleRetry = () => {
    this.resetErrorBoundary()
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
  }

  private copyErrorToClipboard = async () => {
    const { error, errorInfo, errorId } = this.state

    const errorText = `
Error ID: ${errorId}
Error: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
Timestamp: ${new Date().toISOString()}
URL: ${typeof window !== 'undefined' ? window.location.href : 'Unknown'}
User Agent: ${typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown'}
    `.trim()

    try {
      if (typeof window !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(errorText)
        console.log('Error details copied to clipboard')
      }
    } catch (clipboardError) {
      console.error('Failed to copy error details:', clipboardError)
    }
  }

  render() {
    const { hasError, error, errorInfo, errorId } = this.state
    const { children, fallback, showDetails = false, isolateError = false } = this.props

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Default error UI
      return (
        <div className={`error-boundary ${isolateError ? 'error-boundary--isolated' : ''}`}>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <span>Something went wrong</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <Bug className="h-4 w-4" />
                <AlertTitle>Application Error</AlertTitle>
                <AlertDescription>
                  An unexpected error occurred while rendering this component.
                  {errorId && (
                    <div className="mt-2 text-sm font-mono">
                      Error ID: {errorId}
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              {showDetails && error && (
                <div className="space-y-2">
                  <details className="border rounded p-3">
                    <summary className="cursor-pointer font-medium text-sm">
                      Error Details (Click to expand)
                    </summary>
                    <div className="mt-2 text-xs font-mono bg-gray-50 p-2 rounded overflow-auto max-h-48">
                      <div className="space-y-2">
                        <div>
                          <strong>Message:</strong> {error.message}
                        </div>
                        {error.stack && (
                          <div>
                            <strong>Stack:</strong>
                            <pre className="whitespace-pre-wrap">{error.stack}</pre>
                          </div>
                        )}
                        {errorInfo?.componentStack && (
                          <div>
                            <strong>Component Stack:</strong>
                            <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={this.handleRetry}
                  variant="default"
                  size="sm"
                  className="flex items-center space-x-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Try Again</span>
                </Button>

                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reload Page</span>
                </Button>

                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  size="sm"
                  className="flex items-center space-x-1"
                >
                  <Home className="h-4 w-4" />
                  <span>Go Home</span>
                </Button>

                {showDetails && (
                  <Button
                    onClick={this.copyErrorToClipboard}
                    variant="ghost"
                    size="sm"
                    className="flex items-center space-x-1"
                  >
                    <Bug className="h-4 w-4" />
                    <span>Copy Error Details</span>
                  </Button>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                If this problem persists, please contact support with the error ID above.
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return children
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

export default ErrorBoundary