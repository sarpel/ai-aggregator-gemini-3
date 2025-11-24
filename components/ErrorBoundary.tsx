import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  reloadAttempts: number;
}

// FIX: Track reload attempts in localStorage to prevent infinite loops
const MAX_RELOAD_ATTEMPTS = 3;
const RELOAD_ATTEMPTS_KEY = 'errorBoundaryReloadAttempts';
const RELOAD_ATTEMPTS_TIMESTAMP_KEY = 'errorBoundaryReloadTimestamp';
const RELOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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
      errorInfo: null,
      reloadAttempts: this.getReloadAttempts()
    };
  }

  getReloadAttempts(): number {
    try {
      const lastTimestamp = localStorage.getItem(RELOAD_ATTEMPTS_TIMESTAMP_KEY);
      const attempts = localStorage.getItem(RELOAD_ATTEMPTS_KEY);
      
      // Reset attempts if last reload was more than 5 minutes ago
      if (lastTimestamp && Date.now() - parseInt(lastTimestamp) > RELOAD_TIMEOUT_MS) {
        localStorage.removeItem(RELOAD_ATTEMPTS_KEY);
        localStorage.removeItem(RELOAD_ATTEMPTS_TIMESTAMP_KEY);
        return 0;
      }
      
      return attempts ? parseInt(attempts) : 0;
    } catch (e) {
      return 0;
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
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
    // FIX: Prevent infinite reload loops by tracking attempts
    const newAttempts = this.state.reloadAttempts + 1;
    
    if (newAttempts >= MAX_RELOAD_ATTEMPTS) {
      // If we've tried too many times, just clear state and stay on error page
      console.error('Max reload attempts reached. Please manually refresh or clear localStorage.');
      this.setState({
        hasError: true,
        error: new Error('Maximum reload attempts exceeded. Please clear your browser cache and reload manually.'),
        errorInfo: null,
        reloadAttempts: newAttempts
      });
      return;
    }
    
    try {
      localStorage.setItem(RELOAD_ATTEMPTS_KEY, newAttempts.toString());
      localStorage.setItem(RELOAD_ATTEMPTS_TIMESTAMP_KEY, Date.now().toString());
    } catch (e) {
      console.warn('Could not save reload attempts to localStorage');
    }
    
    // Clear the error state first, then reload
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
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
              disabled={this.state.reloadAttempts >= MAX_RELOAD_ATTEMPTS}
              className="px-6 py-3 bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all font-mono text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {this.state.reloadAttempts >= MAX_RELOAD_ATTEMPTS 
                ? 'MAX RETRIES REACHED - CLEAR CACHE' 
                : `RESET APPLICATION (${this.state.reloadAttempts}/${MAX_RELOAD_ATTEMPTS})`}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
