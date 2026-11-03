import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let currentToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

/**
 * Sets or clears the JWT token for all outgoing API requests.
 */
export function setApiAuthToken(token: string | null): void {
  currentToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

/**
 * Registers a callback to run when a 401 Unauthorized response is received.
 */
export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorizedCallback = handler;
}

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (currentToken && config.headers) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor: handle 401 (logout user) and network errors gracefully
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string; message?: string }>) => {
    if (error.response?.status === 401) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }

    if (!error.response) {
      // Network / offline error — preserve local state and provide friendly message
      const networkError = new Error(
        'Unable to reach server. Any active local alarm remains scheduled on your device.'
      );
      return Promise.reject(networkError);
    }

    const serverMessage =
      error.response.data?.detail ||
      error.response.data?.message ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject(new Error(serverMessage));
  }
);

export default api;
