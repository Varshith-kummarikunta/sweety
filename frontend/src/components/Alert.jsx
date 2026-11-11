import React from 'react';

export default function Alert({ type = 'error', message, onClose }) {
  if (!message) return null;

  const isError = type === 'error';
  const alertClass = isError ? 'alert-danger' : 'alert-success';

  return (
    <div className={`alert ${alertClass}`} role="alert">
      <div className="alert-content">
        <span className="alert-icon">{isError ? '⚠️' : '✓'}</span>
        <span className="alert-message">{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          className="alert-close"
          onClick={onClose}
          aria-label="Close message"
        >
          &times;
        </button>
      )}
    </div>
  );
}
