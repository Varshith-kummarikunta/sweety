import React from 'react';

export default function StatCard({ title, value, unit = 'mg/dl', icon = '📊', subtitle = '' }) {
  const displayValue = value !== null && value !== undefined ? value : '—';
  const showUnit = displayValue !== '—' && unit;

  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        <span className="stat-icon" aria-hidden="true">{icon}</span>
      </div>
      <div className="stat-body">
        <span className="stat-value">{displayValue}</span>
        {showUnit && <span className="stat-unit">{unit}</span>}
      </div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
  );
}
