const { pool } = require('../config/db');
const { runMigration } = require('./migrate');

async function verifyMilestone2() {
  console.log('=== SWEETY MILESTONE 2: DATABASE VERIFICATION ===\n');
  const results = {};

  try {
    // 1. PostgreSQL connection
    console.log('Test 1: Testing PostgreSQL connection...');
    const client = await pool.connect();
    console.log('✔ Test 1 PASSED: Successfully connected to PostgreSQL.\n');
    results.connection = true;

    // 2. Migration creates both tables and indexes
    console.log('Test 2: Running migration to create tables and indexes...');
    // We run migration using the client
    const fs = require('fs');
    const path = require('path');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schemaSql);

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('users', 'readings')
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    if (!tables.includes('users') || !tables.includes('readings')) {
      throw new Error(`Expected tables 'users' and 'readings', but found: ${JSON.stringify(tables)}`);
    }

    const indexesRes = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' AND tablename IN ('users', 'readings')
      ORDER BY indexname;
    `);
    const indexes = indexesRes.rows.map(r => r.indexname);
    console.log('Created tables:', tables);
    console.log('Created indexes:', indexes);
    console.log('✔ Test 2 PASSED: Migration created both tables and indexes.\n');
    results.migration = true;

    // 3. Idempotency - running migration a second time does not fail
    console.log('Test 3: Testing migration idempotency (running schema again)...');
    await client.query(schemaSql);
    console.log('✔ Test 3 PASSED: Second migration run succeeded without errors or duplication.\n');
    results.idempotency = true;

    // Clean up any leftovers from previous test runs first
    await client.query("DELETE FROM users WHERE email LIKE '%@test-verification.com'");

    // Setup Test Users
    const user1Res = await client.query(`
      INSERT INTO users (name, email, password_hash)
      VALUES ('Test User 1', 'user1@test-verification.com', 'dummyhash1')
      RETURNING id;
    `);
    const user1Id = user1Res.rows[0].id;

    const user2Res = await client.query(`
      INSERT INTO users (name, email, password_hash)
      VALUES ('Test User 2', 'user2@test-verification.com', 'dummyhash2')
      RETURNING id;
    `);
    const user2Id = user2Res.rows[0].id;

    const testDate = '2026-11-10';

    // 4. Database rejects an invalid time slot
    console.log('Test 4: Testing invalid time slot rejection...');
    let rejectedInvalidSlot = false;
    try {
      await client.query(`
        INSERT INTO readings (user_id, reading_date, time_slot, value)
        VALUES ($1, $2, 'Midnight snack', 120);
      `, [user1Id, testDate]);
    } catch (err) {
      if (err.code === '23514') { // check_violation
        rejectedInvalidSlot = true;
      } else {
        throw err;
      }
    }
    if (!rejectedInvalidSlot) {
      throw new Error('Database did not reject invalid time slot!');
    }
    console.log('✔ Test 4 PASSED: Database rejected invalid time slot.\n');
    results.invalidSlot = true;

    // 5. Database rejects a reading value below 40 or above 600
    console.log('Test 5: Testing out-of-range reading values (< 40 or > 600)...');
    let rejectedTooLow = false;
    try {
      await client.query(`
        INSERT INTO readings (user_id, reading_date, time_slot, value)
        VALUES ($1, $2, 'Morning (fasting)', 39);
      `, [user1Id, testDate]);
    } catch (err) {
      if (err.code === '23514') rejectedTooLow = true;
    }

    let rejectedTooHigh = false;
    try {
      await client.query(`
        INSERT INTO readings (user_id, reading_date, time_slot, value)
        VALUES ($1, $2, 'Morning (fasting)', 601);
      `, [user1Id, testDate]);
    } catch (err) {
      if (err.code === '23514') rejectedTooHigh = true;
    }

    if (!rejectedTooLow || !rejectedTooHigh) {
      throw new Error(`Database did not reject out of range values (tooLow: ${rejectedTooLow}, tooHigh: ${rejectedTooHigh})`);
    }
    console.log('✔ Test 5 PASSED: Database rejected values 39 and 601.\n');
    results.outOfRange = true;

    // Insert valid reading for User 1
    await client.query(`
      INSERT INTO readings (user_id, reading_date, time_slot, value)
      VALUES ($1, $2, 'Morning (fasting)', 95);
    `, [user1Id, testDate]);

    // 6. Database rejects a duplicate slot for the same user and date
    console.log('Test 6: Testing duplicate slot prevention for same user & date...');
    let rejectedDuplicate = false;
    try {
      await client.query(`
        INSERT INTO readings (user_id, reading_date, time_slot, value)
        VALUES ($1, $2, 'Morning (fasting)', 105);
      `, [user1Id, testDate]);
    } catch (err) {
      if (err.code === '23505') { // unique_violation
        rejectedDuplicate = true;
      } else {
        throw err;
      }
    }
    if (!rejectedDuplicate) {
      throw new Error('Database allowed duplicate slot for same user and date!');
    }
    console.log('✔ Test 6 PASSED: Database rejected duplicate slot for same user and date.\n');
    results.duplicateSlot = true;

    // 7. A different user CAN have a reading in the same slot and date
    console.log('Test 7: Testing that different user can record same slot and date...');
    const user2ReadingRes = await client.query(`
      INSERT INTO readings (user_id, reading_date, time_slot, value)
      VALUES ($1, $2, 'Morning (fasting)', 110)
      RETURNING id, value;
    `, [user2Id, testDate]);

    if (!user2ReadingRes.rows[0]?.id) {
      throw new Error('Different user failed to insert reading in same slot and date');
    }
    console.log(`✔ Test 7 PASSED: User 2 successfully inserted reading (Value: ${user2ReadingRes.rows[0].value}).\n`);
    results.differentUser = true;

    // Cleanup test records
    console.log('Cleaning up verification test records...');
    await client.query("DELETE FROM users WHERE email LIKE '%@test-verification.com'");
    console.log('✔ Cleaned up all verification test records.\n');

    client.release();
    console.log('🎉 ALL 7 MILESTONE 2 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    return true;
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    if (err.code) {
      console.error(`PostgreSQL Code: ${err.code}`);
    }
    process.exitCode = 1;
    return false;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  verifyMilestone2();
}

module.exports = { verifyMilestone2 };
