const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

// Development demo user credentials
const DEMO_USER = {
  name: 'Demo User',
  email: 'demo@sweety.local',
  password: 'SweetyDemo123!',
};

// Realistic sample readings spanning October 2026 (previous month) and November 2026 (month-to-date)
const SAMPLE_READINGS = [
  // --- October 2026 (Previous Month) ---
  { reading_date: '2026-10-05', time_slot: 'Morning (fasting)', value: 92 },
  { reading_date: '2026-10-05', time_slot: 'After breakfast', value: 138 },
  { reading_date: '2026-10-05', time_slot: 'After lunch', value: 124 },
  { reading_date: '2026-10-05', time_slot: 'After dinner', value: 145 },

  { reading_date: '2026-10-12', time_slot: 'Morning (fasting)', value: 88 },
  { reading_date: '2026-10-12', time_slot: 'After breakfast', value: 130 },
  { reading_date: '2026-10-12', time_slot: 'After lunch', value: 118 },
  { reading_date: '2026-10-12', time_slot: 'After dinner', value: 140 },

  { reading_date: '2026-10-19', time_slot: 'Morning (fasting)', value: 95 },
  { reading_date: '2026-10-19', time_slot: 'After breakfast', value: 142 },
  { reading_date: '2026-10-19', time_slot: 'After lunch', value: 128 },
  { reading_date: '2026-10-19', time_slot: 'After dinner', value: 150 },

  { reading_date: '2026-10-26', time_slot: 'Morning (fasting)', value: 91 },
  { reading_date: '2026-10-26', time_slot: 'After breakfast', value: 135 },
  { reading_date: '2026-10-26', time_slot: 'After lunch', value: 122 },
  { reading_date: '2026-10-26', time_slot: 'After dinner', value: 144 },

  { reading_date: '2026-10-31', time_slot: 'Morning (fasting)', value: 89 },
  { reading_date: '2026-10-31', time_slot: 'After lunch', value: 120 },
  { reading_date: '2026-10-31', time_slot: 'After dinner', value: 138 },

  // --- November 2026 (Month-to-Date) ---
  { reading_date: '2026-11-02', time_slot: 'Morning (fasting)', value: 94 },
  { reading_date: '2026-11-02', time_slot: 'After breakfast', value: 136 },
  { reading_date: '2026-11-02', time_slot: 'After lunch', value: 125 },
  { reading_date: '2026-11-02', time_slot: 'After dinner', value: 142 },

  { reading_date: '2026-11-06', time_slot: 'Morning (fasting)', value: 87 },
  { reading_date: '2026-11-06', time_slot: 'After breakfast', value: 128 },
  { reading_date: '2026-11-06', time_slot: 'After lunch', value: 115 },
  { reading_date: '2026-11-06', time_slot: 'After dinner', value: 135 },

  { reading_date: '2026-11-09', time_slot: 'Morning (fasting)', value: 96 },
  { reading_date: '2026-11-09', time_slot: 'After breakfast', value: 140 },
  { reading_date: '2026-11-09', time_slot: 'After lunch', value: 130 },
  { reading_date: '2026-11-09', time_slot: 'After dinner', value: 148 },

  { reading_date: '2026-11-10', time_slot: 'Morning (fasting)', value: 90 },
  { reading_date: '2026-11-10', time_slot: 'After breakfast', value: 132 },
  { reading_date: '2026-11-10', time_slot: 'After lunch', value: 121 },
  { reading_date: '2026-11-10', time_slot: 'After dinner', value: 139 },

  { reading_date: '2026-11-11', time_slot: 'Morning (fasting)', value: 93 },
  { reading_date: '2026-11-11', time_slot: 'After breakfast', value: 135 },
  { reading_date: '2026-11-11', time_slot: 'After lunch', value: 126 },
  { reading_date: '2026-11-11', time_slot: 'After dinner', value: 143 },
];

async function seed() {
  console.log('=== Sweety Database Seeding ===');

  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL: Seeding is disabled in production environments.');
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Find or create demo user
    let userId;
    const userRes = await client.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [DEMO_USER.email]
    );

    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
      console.log(`Demo user already exists: ${DEMO_USER.email} (ID: ${userId})`);
    } else {
      const passwordHash = await bcrypt.hash(DEMO_USER.password, 12);
      const insertUserRes = await client.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [DEMO_USER.name, DEMO_USER.email.toLowerCase(), passwordHash]
      );
      userId = insertUserRes.rows[0].id;
      console.log(`Created demo user: ${DEMO_USER.email} (ID: ${userId})`);
    }

    // 2. Insert sample readings idempotently
    let insertedCount = 0;
    let existingCount = 0;

    for (const item of SAMPLE_READINGS) {
      const insertRes = await client.query(
        `INSERT INTO readings (user_id, reading_date, time_slot, value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, reading_date, time_slot) DO NOTHING
         RETURNING id`,
        [userId, item.reading_date, item.time_slot, item.value]
      );

      if (insertRes.rows.length > 0) {
        insertedCount++;
      } else {
        existingCount++;
      }
    }

    await client.query('COMMIT');

    console.log(`\nSeeding Summary:`);
    console.log(`- Total sample records: ${SAMPLE_READINGS.length}`);
    console.log(`- Newly inserted: ${insertedCount}`);
    console.log(`- Already existed: ${existingCount}`);
    console.log(`\nDemo Credentials:`);
    console.log(`- Email:    ${DEMO_USER.email}`);
    console.log(`- Password: ${DEMO_USER.password}`);
    console.log(`\n✔ Database seeding completed successfully.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed with error:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed, DEMO_USER, SAMPLE_READINGS };
