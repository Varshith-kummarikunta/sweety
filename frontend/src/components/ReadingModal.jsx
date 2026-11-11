import React, { useState, useEffect } from 'react';
import Alert from './Alert';

const TIME_SLOTS = [
  'Morning (fasting)',
  'After breakfast',
  'After lunch',
  'After dinner',
];

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

export default function ReadingModal({ isOpen, onClose, onSave, readingToEdit = null }) {
  const [readingDate, setReadingDate] = useState(getTodayString());
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(readingToEdit);
  const todayStr = getTodayString();

  useEffect(() => {
    if (readingToEdit) {
      setReadingDate(readingToEdit.reading_date || todayStr);
      setTimeSlot(readingToEdit.time_slot || TIME_SLOTS[0]);
      setValue(readingToEdit.value !== undefined ? String(readingToEdit.value) : '');
    } else {
      setReadingDate(todayStr);
      setTimeSlot(TIME_SLOTS[0]);
      setValue('');
    }
    setError('');
  }, [readingToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side quick check
    if (value === '' || value === null || value === undefined) {
      setError('Please enter a glucose value.');
      return;
    }

    const numericValue = Number(value);
    if (!Number.isInteger(numericValue) || numericValue < 40 || numericValue > 600) {
      setError('Value must be between 40 and 600 mg/dl.');
      return;
    }

    if (!readingDate) {
      setError('Please provide a valid date in YYYY-MM-DD format.');
      return;
    }

    if (readingDate > todayStr) {
      setError('Date cannot be in the future.');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        id: readingToEdit?.id,
        reading_date: readingDate,
        time_slot: timeSlot,
        value: numericValue,
      });
      onClose();
    } catch (err) {
      // Show exact backend error message
      setError(err.message || 'Failed to save glucose reading.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? 'Edit Blood Glucose Reading' : 'Record Blood Glucose Reading'}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <Alert type="error" message={error} onClose={() => setError('')} />

          <div className="form-group">
            <label htmlFor="reading-date" className="form-label">
              Date:
            </label>
            <input
              id="reading-date"
              type="date"
              className="form-input"
              value={readingDate}
              max={todayStr}
              onChange={(e) => setReadingDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="time-slot" className="form-label">
              Time Slot:
            </label>
            <select
              id="time-slot"
              className="form-select"
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              required
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="glucose-value" className="form-label">
              Glucose Value (mg/dl):
            </label>
            <input
              id="glucose-value"
              type="number"
              step="1"
              min="40"
              max="600"
              placeholder="e.g. 105"
              className="form-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <small className="form-hint">Accepted range: 40 to 600 mg/dl (whole numbers only)</small>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : isEditing ? 'Update Reading' : 'Save Reading'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
