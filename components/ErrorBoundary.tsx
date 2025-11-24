import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 * FIX: Catches unhandled React errors to prevent app crashes
 * This is a critical safety net for production deployments
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // TODO: Send error to error reporting service (e.g., Sentry)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    // Reload the page to reset the app state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-red-900/10 border border-red-500/50 rounded-lg p-8">
            <div className="flex items-center gap-4 mb-6">
              <AlertTriangle className="text-red-500" size={48} />
              <div>
                <h1 className="text-2xl font-bold text-red-500">SYSTEM ERROR</h1>
                <p className="text-gray-400 font-mono text-sm">
                  An unexpected error occurred in the application
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="mb-6 p-4 bg-black/50 rounded border border-red-900/50">
                <p className="font-mono text-sm text-red-400 mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-4">
                    <summary className="text-gray-500 cursor-pointer hover:text-gray-300 text-xs">
                      Stack Trace
                    </summary>
                    <pre className="text-[10px] text-gray-600 mt-2 overflow-x-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="px-6 py-3 bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all font-mono text-sm rounded"
            >
              RESET APPLICATION
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
