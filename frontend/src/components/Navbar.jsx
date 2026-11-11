import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentView, onNavigate, onOpenAddModal }) {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand" onClick={() => onNavigate('dashboard')} role="button" tabIndex={0}>
          <span className="brand-logo" aria-hidden="true">🍬</span>
          <span className="brand-name">Sweety</span>
          <span className="brand-tagline">Blood Glucose Tracker</span>
        </div>

        {user && (
          <div className="navbar-nav">
            <span className="user-greeting">
              Welcome, <strong>{user.name}</strong>
            </span>

            <nav className="nav-links">
              <button
                type="button"
                className={`nav-button ${currentView === 'dashboard' ? 'active' : ''}`}
                onClick={() => onNavigate('dashboard')}
              >
                Dashboard
              </button>

              <button
                type="button"
                className="nav-button nav-button-primary"
                onClick={onOpenAddModal}
              >
                + Add Reading
              </button>

              <button
                type="button"
                className={`nav-button ${currentView === 'reports' ? 'active' : ''}`}
                onClick={() => onNavigate('reports')}
              >
                Reports
              </button>

              <button
                type="button"
                className="nav-button nav-button-logout"
                onClick={logout}
              >
                Logout
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
