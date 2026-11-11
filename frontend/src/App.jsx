import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import ReadingModal from './components/ReadingModal';
import { readingsApi } from './services/api';
import './App.css';

function MainApp() {
  const { isAuthenticated, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'reports'

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [readingToEdit, setReadingToEdit] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (loading) {
    return (
      <div className="app-loader">
        <div className="spinner" aria-hidden="true"></div>
        <p>Loading Sweety...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const handleOpenAddModal = (initialDate = null) => {
    setReadingToEdit(initialDate ? { reading_date: initialDate } : null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (reading) => {
    setReadingToEdit(reading);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setReadingToEdit(null);
  };

  const handleSaveReading = async ({ id, reading_date, time_slot, value }) => {
    if (id) {
      await readingsApi.update(id, reading_date, time_slot, value);
    } else {
      await readingsApi.create(reading_date, time_slot, value);
    }
    // Increment trigger to refresh dashboard data
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="app-layout">
      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenAddModal={() => handleOpenAddModal()}
      />

      <main className="main-content">
        {currentView === 'dashboard' && (
          <DashboardPage
            onOpenAddModal={handleOpenAddModal}
            onEditReading={handleOpenEditModal}
            refreshTrigger={refreshTrigger}
          />
        )}

        {currentView === 'reports' && <ReportsPage />}
      </main>

      <ReadingModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveReading}
        readingToEdit={readingToEdit}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
