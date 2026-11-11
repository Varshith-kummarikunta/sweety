import React from 'react';

const SLOT_ICONS = {
  'Morning (fasting)': '🌅',
  'After breakfast': '🍳',
  'After lunch': '🥗',
  'After dinner': '🍽️',
};

export default function ReadingItem({ reading, onEdit, onDelete }) {
  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the ${reading.time_slot} reading (${reading.value} mg/dl) for ${reading.reading_date}?`
    );
    if (confirmed) {
      onDelete(reading.id);
    }
  };

  const slotIcon = SLOT_ICONS[reading.time_slot] || '⏱️';

  return (
    <div className="reading-card">
      <div className="reading-info">
        <div className="reading-slot-badge">
          <span className="slot-icon" aria-hidden="true">{slotIcon}</span>
          <span className="slot-name">{reading.time_slot}</span>
        </div>
        <div className="reading-date">{reading.reading_date}</div>
      </div>

      <div className="reading-measurement">
        <span className="glucose-number">{reading.value}</span>
        <span className="glucose-unit">mg/dl</span>
      </div>

      <div className="reading-actions">
        <button
          type="button"
          className="btn-icon btn-edit"
          onClick={() => onEdit(reading)}
          title="Edit reading"
          aria-label={`Edit ${reading.time_slot} reading`}
        >
          ✏️ Edit
        </button>
        <button
          type="button"
          className="btn-icon btn-delete"
          onClick={handleDelete}
          title="Delete reading"
          aria-label={`Delete ${reading.time_slot} reading`}
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}
