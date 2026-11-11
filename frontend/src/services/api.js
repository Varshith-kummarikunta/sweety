// Safe environment URL resolution for both Vite client and Node.js test runners
const envBaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL)) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_API_BASE_URL || process.env.VITE_API_URL)) ||
  'http://localhost:5000/api';

export const API_BASE_URL = envBaseUrl;

// Safe localStorage abstraction
const storage =
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : (function createMemoryStorage() {
        let store = {};
        return {
          getItem: (key) => store[key] || null,
          setItem: (key, val) => {
            store[key] = String(val);
          },
          removeItem: (key) => {
            delete store[key];
          },
          clear: () => {
            store = {};
          },
        };
      })();

/**
 * Get stored authentication token
 */
export function getToken() {
  return storage.getItem('sweety_token');
}

/**
 * Set authentication token
 */
export function setToken(token) {
  if (token) {
    storage.setItem('sweety_token', token);
  } else {
    storage.removeItem('sweety_token');
  }
}

/**
 * Get stored user information
 */
export function getStoredUser() {
  const userJson = storage.getItem('sweety_user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

/**
 * Set stored user information
 */
export function setStoredUser(user) {
  if (user) {
    storage.setItem('sweety_user', JSON.stringify(user));
  } else {
    storage.removeItem('sweety_user');
  }
}

/**
 * Clear all stored auth data
 */
export function clearAuth() {
  storage.removeItem('sweety_token');
  storage.removeItem('sweety_user');
}

/**
 * Generic request helper
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle unauthorized response (e.g. token expired) on protected endpoints
  if (response.status === 401 && !endpoint.startsWith('/auth/login')) {
    clearAuth();
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('sweety_auth_expired'));
    }
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { error: await response.text() };
  }

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Auth API
export const authApi = {
  register: (name, email, password) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email, password) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => apiRequest('/auth/me', { method: 'GET' }),
};

// Readings API
export const readingsApi = {
  list: () => apiRequest('/readings', { method: 'GET' }),
  getById: (id) => apiRequest(`/readings/${id}`, { method: 'GET' }),
  create: (reading_date, time_slot, value) =>
    apiRequest('/readings', {
      method: 'POST',
      body: JSON.stringify({ reading_date, time_slot, value }),
    }),
  update: (id, reading_date, time_slot, value) =>
    apiRequest(`/readings/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ reading_date, time_slot, value }),
    }),
  delete: (id) =>
    apiRequest(`/readings/${id}`, {
      method: 'DELETE',
    }),
};

// Reports API
export const reportsApi = {
  getDaily: (date) => apiRequest(`/reports/daily?date=${date}`, { method: 'GET' }),
  getMonthToDate: (date) => apiRequest(`/reports/month-to-date?date=${date}`, { method: 'GET' }),
  getMonthly: (date) => apiRequest(`/reports/monthly?date=${date}`, { method: 'GET' }),
};
