import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  authApi,
  getToken,
  setToken,
  getStoredUser,
  setStoredUser,
  clearAuth,
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [token, setTokenState] = useState(getToken());
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    async function initAuth() {
      const existingToken = getToken();
      if (!existingToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await authApi.getMe();
        if (res && res.user) {
          setUser(res.user);
          setStoredUser(res.user);
          setTokenState(existingToken);
        }
      } catch (err) {
        // If token expired or invalid, reset
        console.warn('Session verification failed, logging out.');
        clearAuth();
        setUser(null);
        setTokenState(null);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    // Listen to session expiry from api helper
    function handleExpired() {
      setUser(null);
      setTokenState(null);
    }

    window.addEventListener('sweety_auth_expired', handleExpired);
    return () => window.removeEventListener('sweety_auth_expired', handleExpired);
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    setStoredUser(res.user);
    setTokenState(res.token);
    setUser(res.user);
    return res;
  };

  const register = async (name, email, password) => {
    const res = await authApi.register(name, email, password);
    setToken(res.token);
    setStoredUser(res.user);
    setTokenState(res.token);
    setUser(res.user);
    return res;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setTokenState(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
