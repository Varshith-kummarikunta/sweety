import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleMode = () => {
    setIsLoginMode((prev) => !prev);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleFillDemo = () => {
    setEmail('demo@sweety.local');
    setPassword('SweetyDemo123!');
    setIsLoginMode(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (!isLoginMode) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('Please enter your full name.');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match. Please check again.');
        return;
      }

      setLoading(true);
      try {
        await register(trimmedName, trimmedEmail, password);
      } catch (err) {
        setError(err.message || 'Registration failed.');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        await login(trimmedEmail, password);
      } catch (err) {
        setError(err.message || 'Login failed.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo" aria-hidden="true">🍬</div>
          <h1 className="auth-title">Sweety</h1>
          <p className="auth-subtitle">Blood Glucose Tracker</p>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={`auth-tab ${isLoginMode ? 'active' : ''}`}
            onClick={() => !isLoginMode && toggleMode()}
            role="tab"
            aria-selected={isLoginMode}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${!isLoginMode ? 'active' : ''}`}
            onClick={() => isLoginMode && toggleMode()}
            role="tab"
            aria-selected={!isLoginMode}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <Alert type="error" message={error} onClose={() => setError('')} />

          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="auth-name" className="form-label">
                Full Name:
              </label>
              <input
                id="auth-name"
                type="text"
                className="form-input"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email" className="form-label">
              Email Address:
            </label>
            <input
              id="auth-email"
              type="email"
              className="form-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password" className="form-label">
              Password:
            </label>
            <input
              id="auth-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="auth-confirm-password" className="form-label">
                Confirm Password:
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={loading}
          >
            {loading ? 'Processing...' : isLoginMode ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          {isLoginMode ? (
            <p>
              Don't have an account yet?{' '}
              <button type="button" className="link-button" onClick={toggleMode}>
                Create an account
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button type="button" className="link-button" onClick={toggleMode}>
                Sign in here
              </button>
            </p>
          )}

          <div className="demo-fill-box">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleFillDemo}
            >
              Fill Demo Credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
