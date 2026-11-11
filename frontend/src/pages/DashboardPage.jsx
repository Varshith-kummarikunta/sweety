import React, { useState, useEffect, useCallback } from 'react';
import { reportsApi, readingsApi } from '../services/api';
import StatCard from '../components/StatCard';
import ReadingItem from '../components/ReadingItem';
import Alert from '../components/Alert';

/**
 * Returns today's date in YYYY-MM-DD local format
 */
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DashboardPage({ onOpenAddModal, onEditReading, refreshTrigger }) {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const todayStr = getTodayString();

  const fetchDailyData = useCallback(async (date) => {
    setLoading(true);
    setError('');
    try {
      const data = await reportsApi.getDaily(date);
      setReportData(data);
    } catch (err) {
      setError(err.message || 'Failed to load glucose readings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyData(selectedDate);
  }, [selectedDate, refreshTrigger, fetchDailyData]);

  const handleDeleteReading = async (readingId) => {
    try {
      await readingsApi.delete(readingId);
      setFeedback('Reading deleted successfully.');
      fetchDailyData(selectedDate);
    } catch (err) {
      setError(err.message || 'Failed to delete reading.');
    }
  };

  const readings = reportData?.readings || [];
  const count = reportData?.count || 0;

  return (
    <div className="dashboard-page">
      <div className="dashboard-toolbar">
        <div className="date-selector-group">
          <label htmlFor="dashboard-date" className="date-label">
            Selected Date:
          </label>
          <input
            id="dashboard-date"
            type="date"
            className="form-input date-input"
            value={selectedDate}
            max={todayStr}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setFeedback('');
            }}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpenAddModal(selectedDate)}
        >
          + Add Reading
        </button>
      </div>

      <Alert type="error" message={error} onClose={() => setError('')} />
      <Alert type="success" message={feedback} onClose={() => setFeedback('')} />

      {/* Summary Metrics */}
      <section className="stats-grid" aria-label="Daily glycemic summary">
        <StatCard
          title="Highest Reading"
          value={reportData?.highest}
          unit="mg/dl"
          icon="📈"
          subtitle="Peak value"
        />
        <StatCard
          title="Lowest Reading"
          value={reportData?.lowest}
          unit="mg/dl"
          icon="📉"
          subtitle="Minimum value"
        />
        <StatCard
          title="Average Glucose"
          value={reportData?.average}
          unit="mg/dl"
          icon="🎯"
          subtitle="Mean (rounded)"
        />
        <StatCard
          title="Readings Count"
          value={count}
          unit={count === 1 ? 'reading' : 'readings'}
          icon="📝"
          subtitle="Max 4 per day"
        />
      </section>

      {/* Daily Readings Section */}
      <section className="readings-section">
        <div className="section-header">
          <h2 className="section-title">
            Readings for {selectedDate} {selectedDate === todayStr ? '(Today)' : ''}
          </h2>
          <span className="count-pill">{count} / 4 Recorded</span>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner" aria-hidden="true"></div>
            <p>Loading glucose readings...</p>
          </div>
        ) : readings.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">🩸</span>
            <h3>No readings recorded for this date</h3>
            <p>You have not logged any blood glucose readings for {selectedDate}.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onOpenAddModal(selectedDate)}
            >
              Record First Reading
            </button>
          </div>
        ) : (
          <div className="readings-list">
            {readings.map((reading) => (
              <ReadingItem
                key={reading.id}
                reading={reading}
                onEdit={onEditReading}
                onDelete={handleDeleteReading}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
