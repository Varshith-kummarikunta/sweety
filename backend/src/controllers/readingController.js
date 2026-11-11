const { pool, query } = require('../config/db');

const ALLOWED_SLOTS = [
  'Morning (fasting)',
  'After breakfast',
  'After lunch',
  'After dinner'
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns grammatical article ('a' or 'an') for a time slot
 */
function getDuplicateSlotMessage(timeSlot) {
  const article = /^[aeiou]/i.test(timeSlot) ? 'an' : 'a';
  return `You already have ${article} ${timeSlot} reading for this date.`;
}

/**
 * Validates calendar date without Javascript rollover
 */
function isValidCalendarDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
}

/**
 * Validates that date is not later than today (local date)
 */
function isFutureDate(dateStr) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  return dateStr > todayStr;
}

/**
 * Shared validation for reading input
 */
function validateReadingInput({ reading_date, time_slot, value }) {
  // 1. Value validation
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: 'Please enter a glucose value.' };
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || isNaN(value) || value < 40 || value > 600) {
    return { valid: false, error: 'Value must be between 40 and 600 mg/dl.' };
  }

  // 2. Date validation
  if (!reading_date || typeof reading_date !== 'string') {
    return { valid: false, error: 'Please enter a valid calendar date in YYYY-MM-DD format.' };
  }

  if (!isValidCalendarDate(reading_date)) {
    return { valid: false, error: 'Please enter a valid calendar date in YYYY-MM-DD format.' };
  }

  if (isFutureDate(reading_date)) {
    return { valid: false, error: 'Date cannot be in the future.' };
  }

  // 3. Time slot validation
  if (!time_slot || typeof time_slot !== 'string' || !ALLOWED_SLOTS.includes(time_slot)) {
    return {
      valid: false,
      error: `Invalid time slot. Allowed slots: ${ALLOWED_SLOTS.join(', ')}.`
    };
  }

  return { valid: true };
}

/**
 * Create a new reading
 * POST /api/readings
 */
async function createReading(req, res) {
  const { reading_date, time_slot, value } = req.body || {};

  const validation = validateReadingInput({ reading_date, time_slot, value });
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock user row with SELECT ... FOR UPDATE to serialize concurrent requests
    const userLock = await client.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [req.user.id]
    );

    if (userLock.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Check existing count for target date before checking duplicate slot
    const countRes = await client.query(
      'SELECT COUNT(*)::int AS count FROM readings WHERE user_id = $1 AND reading_date = $2',
      [req.user.id, reading_date]
    );

    if (countRes.rows[0].count >= 4) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You can add only 4 readings per day.' });
    }

    // Check whether the requested slot already exists for this date
    const slotRes = await client.query(
      'SELECT id FROM readings WHERE user_id = $1 AND reading_date = $2 AND time_slot = $3',
      [req.user.id, reading_date, time_slot]
    );

    if (slotRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: getDuplicateSlotMessage(time_slot) });
    }

    // Insert reading
    const insertRes = await client.query(
      `INSERT INTO readings (user_id, reading_date, time_slot, value)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date, time_slot, value, created_at`,
      [req.user.id, reading_date, time_slot, value]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      message: 'Reading recorded successfully',
      reading: insertRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(400).json({ error: getDuplicateSlotMessage(time_slot) });
    }
    console.error('Error creating reading:', error.message);
    return res.status(500).json({ error: 'Failed to record reading' });
  } finally {
    client.release();
  }
}

/**
 * List readings belonging to authenticated user
 * GET /api/readings
 */
async function listReadings(req, res) {
  try {
    const readingsRes = await query(
      `SELECT id, user_id, TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date, time_slot, value, created_at
       FROM readings
       WHERE user_id = $1
       ORDER BY reading_date DESC,
         CASE time_slot
           WHEN 'Morning (fasting)' THEN 1
           WHEN 'After breakfast' THEN 2
           WHEN 'After lunch' THEN 3
           WHEN 'After dinner' THEN 4
           ELSE 5
         END ASC`,
      [req.user.id]
    );

    return res.status(200).json({ readings: readingsRes.rows });
  } catch (error) {
    console.error('Error listing readings:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve readings' });
  }
}

/**
 * Get single reading by ID
 * GET /api/readings/:id
 */
async function getReadingById(req, res) {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    const readingRes = await query(
      `SELECT id, user_id, TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date, time_slot, value, created_at
       FROM readings
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (readingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    return res.status(200).json({ reading: readingRes.rows[0] });
  } catch (error) {
    console.error('Error fetching reading by id:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve reading' });
  }
}

/**
 * Update reading
 * PUT /api/readings/:id
 */
async function updateReading(req, res) {
  const { id } = req.params;

  if (!UUID_REGEX.test(id)) {
    return res.status(404).json({ error: 'Reading not found' });
  }

  const { reading_date, time_slot, value } = req.body || {};

  const validation = validateReadingInput({ reading_date, time_slot, value });
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Serialize access for user
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);

    // Verify ownership and lock target reading
    const existingRes = await client.query(
      `SELECT id, user_id, TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date, time_slot, value
       FROM readings
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [id, req.user.id]
    );

    if (existingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reading not found' });
    }

    // Check destination date count excluding current reading
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS count 
       FROM readings 
       WHERE user_id = $1 AND reading_date = $2 AND id != $3`,
      [req.user.id, reading_date, id]
    );

    if (countRes.rows[0].count >= 4) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You can add only 4 readings per day.' });
    }

    // Check duplicate slot on destination date excluding current reading
    const slotRes = await client.query(
      `SELECT id 
       FROM readings 
       WHERE user_id = $1 AND reading_date = $2 AND time_slot = $3 AND id != $4`,
      [req.user.id, reading_date, time_slot, id]
    );

    if (slotRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: getDuplicateSlotMessage(time_slot) });
    }

    // Perform update
    const updateRes = await client.query(
      `UPDATE readings
       SET reading_date = $1, time_slot = $2, value = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date, time_slot, value, created_at`,
      [reading_date, time_slot, value, id, req.user.id]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      message: 'Reading updated successfully',
      reading: updateRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(400).json({ error: getDuplicateSlotMessage(time_slot) });
    }
    console.error('Error updating reading:', error.message);
    return res.status(500).json({ error: 'Failed to update reading' });
  } finally {
    client.release();
  }
}

/**
 * Delete reading
 * DELETE /api/readings/:id
 */
async function deleteReading(req, res) {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    const deleteRes = await query(
      'DELETE FROM readings WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    return res.status(200).json({
      message: 'Reading deleted successfully',
      id,
    });
  } catch (error) {
    console.error('Error deleting reading:', error.message);
    return res.status(500).json({ error: 'Failed to delete reading' });
  }
}

module.exports = {
  createReading,
  listReadings,
  getReadingById,
  updateReading,
  deleteReading,
};
