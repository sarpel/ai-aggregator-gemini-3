/**
 * API Configuration
 * FIX: Centralized configuration to avoid hardcoded URLs throughout the codebase
 * This makes it easier to switch between development and production environments
 */

// Determine the API base URL based on environment
const getApiBaseUrl = (): string => {
  // Check if running in production (served from same domain)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    // In production, assume backend is on same host, different port or path
    return `${window.location.protocol}//${window.location.hostname}:3002`;
  }
  
  // Development default
  return 'http://localhost:3002';
};

export const API_CONFIG = {
  baseUrl: getApiBaseUrl(),
  
  endpoints: {
    health: '/health',
    history: '/api/history',
    geminiProxy: '/api/proxy/gemini',
    anthropicProxy: '/api/proxy/anthropic',
    openaiProxy: '/api/proxy/openai-compatible',
    modelsProxy: '/api/proxy/models',
  },
  
  // Request timeouts (in milliseconds)
  timeouts: {
    default: 30000,    // 30 seconds
    longRunning: 120000, // 2 minutes for streaming operations
  }
};

// Helper functions to build full URLs
export const getApiUrl = (endpoint: keyof typeof API_CONFIG.endpoints): string => {
  return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}`;
};

// FIX: Type-safe API URL builder
export const buildApiUrl = (path: string): string => {
  return `${API_CONFIG.baseUrl}${path}`;
};
