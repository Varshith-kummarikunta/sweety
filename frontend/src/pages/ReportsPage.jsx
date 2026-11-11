import React, { useState, useEffect, useCallback } from 'react';
import { reportsApi } from '../services/api';
import StatCard from '../components/StatCard';
import Alert from '../components/Alert';

const SLOT_ICONS = {
  'Morning (fasting)': '🌅',
  'After breakfast': '🍳',
  'After lunch': '🥗',
  'After dinner': '🍽️',
};

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

export default function ReportsPage() {
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'mtd' | 'monthly'

  const [dailyData, setDailyData] = useState(null);
  const [mtdData, setMtdData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const todayStr = getTodayString();

  const fetchReports = useCallback(async (date) => {
    setLoading(true);
    setError('');
    try {
      // Fetch all three report sets concurrently
      const [dailyRes, mtdRes, monthlyRes] = await Promise.all([
        reportsApi.getDaily(date),
        reportsApi.getMonthToDate(date),
        reportsApi.getMonthly(date),
      ]);
      setDailyData(dailyRes);
      setMtdData(mtdRes);
      setMonthlyData(monthlyRes);
    } catch (err) {
      setError(err.message || 'Failed to generate glucose reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(selectedDate);
  }, [selectedDate, fetchReports]);

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1 className="page-title">Glucose Summary Reports</h1>
          <p className="page-subtitle">Analyze daily glycemic patterns, month-to-date trends, and historical metrics.</p>
        </div>

        <div className="date-selector-group">
          <label htmlFor="report-date" className="date-label">
            Reference Date:
          </label>
          <input
            id="report-date"
            type="date"
            className="form-input date-input"
            value={selectedDate}
            max={todayStr}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <Alert type="error" message={error} onClose={() => setError('')} />

      {/* Report Navigation Tabs */}
      <div className="report-tabs" role="tablist">
        <button
          type="button"
          className={`report-tab ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
          role="tab"
          aria-selected={activeTab === 'daily'}
        >
          Daily Report
        </button>
        <button
          type="button"
          className={`report-tab ${activeTab === 'mtd' ? 'active' : ''}`}
          onClick={() => setActiveTab('mtd')}
          role="tab"
          aria-selected={activeTab === 'mtd'}
        >
          Month-to-Date (MTD)
        </button>
        <button
          type="button"
          className={`report-tab ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
          role="tab"
          aria-selected={activeTab === 'monthly'}
        >
          Previous Month
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" aria-hidden="true"></div>
          <p>Compiling report data...</p>
        </div>
      ) : (
        <div className="report-content">
          {/* TAB 1: DAILY REPORT */}
          {activeTab === 'daily' && (
            <div className="report-section">
              <div className="report-period-badge">
                Report Period: <strong>{dailyData?.date || selectedDate}</strong>
              </div>

              <div className="stats-grid">
                <StatCard
                  title="Highest"
                  value={dailyData?.highest}
                  unit="mg/dl"
                  icon="📈"
                />
                <StatCard
                  title="Lowest"
                  value={dailyData?.lowest}
                  unit="mg/dl"
                  icon="📉"
                />
                <StatCard
                  title="Average (rounded)"
                  value={dailyData?.average}
                  unit="mg/dl"
                  icon="🎯"
                />
                <StatCard
                  title="Total Readings"
                  value={dailyData?.count || 0}
                  unit="readings"
                  icon="📝"
                />
              </div>

              <div className="daily-readings-breakdown">
                <h3>Readings Breakdown</h3>
                {!dailyData?.readings || dailyData.readings.length === 0 ? (
                  <div className="empty-state-card">
                    <p>No glucose readings recorded on {selectedDate}.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="reports-table">
                      <thead>
                        <tr>
                          <th>Time Slot</th>
                          <th>Glucose Value</th>
                          <th>Recorded Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyData.readings.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <span className="slot-pill">
                                {SLOT_ICONS[r.time_slot] || ''} {r.time_slot}
                              </span>
                            </td>
                            <td>
                              <strong className="table-value">{r.value}</strong> mg/dl
                            </td>
                            <td className="text-muted">
                              {new Date(r.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MONTH-TO-DATE REPORT */}
          {activeTab === 'mtd' && (
            <div className="report-section">
              <div className="report-period-badge">
                Report Period: <strong>{mtdData?.start_date}</strong> through <strong>{mtdData?.end_date}</strong>
              </div>

              <div className="stats-grid">
                <StatCard
                  title="Highest (MTD)"
                  value={mtdData?.highest}
                  unit="mg/dl"
                  icon="📈"
                />
                <StatCard
                  title="Lowest (MTD)"
                  value={mtdData?.lowest}
                  unit="mg/dl"
                  icon="📉"
                />
                <StatCard
                  title="Average (MTD)"
                  value={mtdData?.average}
                  unit="mg/dl"
                  icon="🎯"
                />
                <StatCard
                  title="Total Readings (MTD)"
                  value={mtdData?.count || 0}
                  unit="readings"
                  icon="📝"
                />
              </div>

              {mtdData?.count === 0 && (
                <div className="empty-state-card">
                  <p>No readings recorded for the current month-to-date period ({mtdData?.start_date} to {mtdData?.end_date}).</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PREVIOUS-MONTH REPORT */}
          {activeTab === 'monthly' && (
            <div className="report-section">
              <div className="report-period-badge">
                Report Period: <strong>{monthlyData?.start_date}</strong> through <strong>{monthlyData?.end_date}</strong> (Full Calendar Month)
              </div>

              <div className="stats-grid">
                <StatCard
                  title="Highest (Previous Month)"
                  value={monthlyData?.highest}
                  unit="mg/dl"
                  icon="📈"
                />
                <StatCard
                  title="Lowest (Previous Month)"
                  value={monthlyData?.lowest}
                  unit="mg/dl"
                  icon="📉"
                />
                <StatCard
                  title="Average (Previous Month)"
                  value={monthlyData?.average}
                  unit="mg/dl"
                  icon="🎯"
                />
                <StatCard
                  title="Total Readings"
                  value={monthlyData?.count || 0}
                  unit="readings"
                  icon="📝"
                />
              </div>

              {monthlyData?.count === 0 && (
                <div className="empty-state-card">
                  <p>No readings recorded for the previous calendar month ({monthlyData?.start_date} to {monthlyData?.end_date}).</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
