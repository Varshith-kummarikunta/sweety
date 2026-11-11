const { query } = require('../config/db');

/**
 * Validates calendar date without JavaScript rollover
 * Format must strictly be YYYY-MM-DD
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
 * Checks whether the date is strictly in the future relative to local current date
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
 * Validates query date parameter for reporting endpoints
 */
function validateReportDate(dateStr) {
  if (!dateStr || !isValidCalendarDate(dateStr)) {
    return {
      valid: false,
      status: 400,
      error: 'Please provide a valid date in YYYY-MM-DD format.',
    };
  }

  if (isFutureDate(dateStr)) {
    return {
      valid: false,
      status: 400,
      error: 'Date cannot be in the future.',
    };
  }

  return { valid: true };
}

/**
 * Calculates start and end dates for Month-to-Date
 */
function getMonthToDateBounds(dateStr) {
  const [year, month] = dateStr.split('-');
  return {
    startDate: `${year}-${month}-01`,
    endDate: dateStr,
  };
}

/**
 * Calculates start and end dates for Previous Calendar Month
 */
function getPreviousMonthBounds(dateStr) {
  const [yearNum, monthNum] = dateStr.split('-').map(Number);
  let prevYear = yearNum;
  let prevMonth = monthNum - 1;

  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = yearNum - 1;
  }

  const prevMonthStr = String(prevMonth).padStart(2, '0');
  const daysInMonth = new Date(prevYear, prevMonth, 0).getDate();

  return {
    startDate: `${prevYear}-${prevMonthStr}-01`,
    endDate: `${prevYear}-${prevMonthStr}-${String(daysInMonth).padStart(2, '0')}`,
  };
}

/**
 * Executes aggregate query for report metrics
 */
async function fetchAggregateMetrics(userId, startDate, endDate) {
  const sql = `
    SELECT 
      MAX(value) AS highest,
      MIN(value) AS lowest,
      ROUND(AVG(value)::numeric, 1) AS average,
      COUNT(*)::int AS count
    FROM readings
    WHERE user_id = $1 AND reading_date >= $2 AND reading_date <= $3
  `;

  const res = await query(sql, [userId, startDate, endDate]);
  const row = res.rows[0];

  const count = Number(row.count) || 0;
  if (count === 0) {
    return {
      highest: null,
      lowest: null,
      average: null,
      count: 0,
    };
  }

  return {
    highest: Number(row.highest),
    lowest: Number(row.lowest),
    average: parseFloat(row.average),
    count,
  };
}

/**
 * Daily Report
 * GET /api/reports/daily?date=YYYY-MM-DD
 */
async function getDailyReport(req, res) {
  try {
    const { date } = req.query;

    const validation = validateReportDate(date);
    if (!validation.valid) {
      return res.status(validation.status).json({ error: validation.error });
    }

    // 1. Fetch aggregate metrics
    const metrics = await fetchAggregateMetrics(req.user.id, date, date);

    // 2. Fetch individual readings ordered by time slot
    const readingsSql = `
      SELECT 
        id, 
        user_id, 
        TO_CHAR(reading_date, 'YYYY-MM-DD') AS reading_date, 
        time_slot, 
        value, 
        created_at
      FROM readings
      WHERE user_id = $1 AND reading_date = $2
      ORDER BY
        CASE time_slot
          WHEN 'Morning (fasting)' THEN 1
          WHEN 'After breakfast' THEN 2
          WHEN 'After lunch' THEN 3
          WHEN 'After dinner' THEN 4
          ELSE 5
        END ASC
    `;

    const readingsRes = await query(readingsSql, [req.user.id, date]);

    return res.status(200).json({
      date,
      highest: metrics.highest,
      lowest: metrics.lowest,
      average: metrics.average,
      count: metrics.count,
      readings: readingsRes.rows,
    });
  } catch (error) {
    console.error('Error generating daily report:', error.message);
    return res.status(500).json({ error: 'Failed to generate daily report' });
  }
}

/**
 * Month-to-Date Report
 * GET /api/reports/month-to-date?date=YYYY-MM-DD
 */
async function getMonthToDateReport(req, res) {
  try {
    const { date } = req.query;

    const validation = validateReportDate(date);
    if (!validation.valid) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const { startDate, endDate } = getMonthToDateBounds(date);
    const metrics = await fetchAggregateMetrics(req.user.id, startDate, endDate);

    return res.status(200).json({
      start_date: startDate,
      end_date: endDate,
      highest: metrics.highest,
      lowest: metrics.lowest,
      average: metrics.average,
      count: metrics.count,
    });
  } catch (error) {
    console.error('Error generating month-to-date report:', error.message);
    return res.status(500).json({ error: 'Failed to generate month-to-date report' });
  }
}

/**
 * Previous-Month Report
 * GET /api/reports/monthly?date=YYYY-MM-DD
 */
async function getPreviousMonthReport(req, res) {
  try {
    const { date } = req.query;

    const validation = validateReportDate(date);
    if (!validation.valid) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const { startDate, endDate } = getPreviousMonthBounds(date);
    const metrics = await fetchAggregateMetrics(req.user.id, startDate, endDate);

    return res.status(200).json({
      start_date: startDate,
      end_date: endDate,
      highest: metrics.highest,
      lowest: metrics.lowest,
      average: metrics.average,
      count: metrics.count,
    });
  } catch (error) {
    console.error('Error generating monthly report:', error.message);
    return res.status(500).json({ error: 'Failed to generate monthly report' });
  }
}

module.exports = {
  getDailyReport,
  getMonthToDateReport,
  getPreviousMonthReport,
};
