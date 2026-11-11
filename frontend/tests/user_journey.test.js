import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const app = require('../../backend/src/app.js');
const { pool, query } = require('../../backend/src/config/db.js');

let server;
let baseUrl;
let authApi, readingsApi, reportsApi, getToken, setToken, clearAuth, setStoredUser, getStoredUser;

describe('Frontend Integration: Complete 16 User Journeys', () => {
  before(async () => {
    // 1. Ensure test database tables are ready
    const fs = require('fs');
    const path = require('path');
    const schemaSql = fs.readFileSync(path.join(process.cwd(), '../backend/src/db/schema.sql'), 'utf8');
    await pool.query(schemaSql);
    await query('DELETE FROM readings');
    await query('DELETE FROM users');

    // 2. Start ephemeral HTTP server for backend
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;
    process.env.VITE_API_BASE_URL = baseUrl;

    // 3. Dynamically import api helper so it picks up the ephemeral server baseUrl
    const apiModule = await import('../src/services/api.js?t=' + Date.now());
    authApi = apiModule.authApi;
    readingsApi = apiModule.readingsApi;
    reportsApi = apiModule.reportsApi;
    getToken = apiModule.getToken;
    setToken = apiModule.setToken;
    clearAuth = apiModule.clearAuth;
    setStoredUser = apiModule.setStoredUser;
    getStoredUser = apiModule.getStoredUser;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await query('DELETE FROM readings');
    await query('DELETE FROM users');
    await pool.end();
  });

  const testEmail = 'journey.user@sweety.local';
  const testPassword = 'SecurePassword123!';
  let createdReadingId;

  // Journey 1: Register a new user
  test('Journey 1: Register a new user via authApi.register', async () => {
    clearAuth();
    const res = await authApi.register('Journey User', testEmail, testPassword);
    assert.ok(res.token, 'Should receive token');
    assert.strictEqual(res.user.email, testEmail);
    // Client stores token & user
    setToken(res.token);
    setStoredUser(res.user);
    assert.strictEqual(getToken(), res.token);
    assert.strictEqual(getStoredUser().email, testEmail);
  });

  // Journey 2: Log in with valid credentials
  test('Journey 2: Log in with valid credentials via authApi.login', async () => {
    clearAuth();
    const res = await authApi.login(testEmail, testPassword);
    assert.ok(res.token);
    assert.strictEqual(res.user.email, testEmail);
    setToken(res.token);
    setStoredUser(res.user);
    assert.ok(getToken());
  });

  // Journey 3: Log in with invalid credentials
  test('Journey 3: Log in with invalid credentials is rejected with 401', async () => {
    await assert.rejects(
      async () => {
        await authApi.login(testEmail, 'WrongPassword999!');
      },
      (err) => {
        assert.strictEqual(err.status, 401);
        assert.strictEqual(err.message, 'Invalid email or password');
        return true;
      }
    );
  });

  // Journey 4: Refresh page and verify session
  test('Journey 4: Refresh the page and verify session via authApi.getMe', async () => {
    // Stored token is still in place
    assert.ok(getToken(), 'Token should be persisted in storage');
    const meRes = await authApi.getMe();
    assert.ok(meRes.user);
    assert.strictEqual(meRes.user.email, testEmail);
    assert.strictEqual(meRes.user.name, 'Journey User');
  });

  // Journey 5: Add a glucose reading
  test('Journey 5: Add a glucose reading via readingsApi.create', async () => {
    const res = await readingsApi.create('2026-11-10', 'Morning (fasting)', 98);
    assert.ok(res.reading);
    assert.strictEqual(res.reading.value, 98);
    assert.strictEqual(res.reading.time_slot, 'Morning (fasting)');
    assert.strictEqual(res.reading.reading_date, '2026-11-10');
    createdReadingId = res.reading.id;
  });

  // Journey 6: View the reading (list and single item)
  test('Journey 6: View the reading via readingsApi.list and getById', async () => {
    const listRes = await readingsApi.list();
    assert.strictEqual(listRes.readings.length, 1);
    assert.strictEqual(listRes.readings[0].id, createdReadingId);
    assert.strictEqual(listRes.readings[0].value, 98);

    const singleRes = await readingsApi.getById(createdReadingId);
    assert.strictEqual(singleRes.reading.id, createdReadingId);
    assert.strictEqual(singleRes.reading.value, 98);
  });

  // Journey 7: Edit the reading
  test('Journey 7: Edit the reading via readingsApi.update', async () => {
    const updateRes = await readingsApi.update(
      createdReadingId,
      '2026-11-10',
      'Morning (fasting)',
      104
    );
    assert.strictEqual(updateRes.reading.value, 104);

    const getRes = await readingsApi.getById(createdReadingId);
    assert.strictEqual(getRes.reading.value, 104);
  });

  // Journey 8: Delete the reading
  test('Journey 8: Delete the reading via readingsApi.delete', async () => {
    // Create temporary reading to delete
    const tempRes = await readingsApi.create('2026-11-10', 'After dinner', 145);
    const tempId = tempRes.reading.id;

    const delRes = await readingsApi.delete(tempId);
    assert.ok(delRes.message.includes('deleted'));

    // Confirm it returns 404 now
    await assert.rejects(
      async () => {
        await readingsApi.getById(tempId);
      },
      (err) => {
        assert.strictEqual(err.status, 404);
        return true;
      }
    );
  });

  // Journey 9: Verify duplicate-slot validation
  test('Journey 9: Duplicate slot validation returns exact message', async () => {
    // Current reading is Morning (fasting) on 2026-11-10
    await assert.rejects(
      async () => {
        await readingsApi.create('2026-11-10', 'Morning (fasting)', 110);
      },
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.message, 'You already have a Morning (fasting) reading for this date.');
        return true;
      }
    );
  });

  // Journey 10: Verify the daily four-reading limit
  test('Journey 10: Fifth reading on same date is rejected with exact message', async () => {
    // Add breakfast, lunch, and dinner (we already have fasting)
    await readingsApi.create('2026-11-10', 'After breakfast', 135);
    await readingsApi.create('2026-11-10', 'After lunch', 125);
    await readingsApi.create('2026-11-10', 'After dinner', 142);

    // Attempt 5th reading on same date
    await assert.rejects(
      async () => {
        await readingsApi.create('2026-11-10', 'After lunch', 130);
      },
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.message, 'You can add only 4 readings per day.');
        return true;
      }
    );
  });

  // Journey 11: Verify invalid and future dates
  test('Journey 11: Future dates and invalid calendar dates are rejected', async () => {
    // Future date
    await assert.rejects(
      async () => {
        await readingsApi.create('2099-12-31', 'Morning (fasting)', 100);
      },
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.strictEqual(err.message, 'Date cannot be in the future.');
        return true;
      }
    );

    // Invalid calendar date
    await assert.rejects(
      async () => {
        await readingsApi.create('2026-02-30', 'Morning (fasting)', 100);
      },
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.ok(err.message.includes('valid calendar date'));
        return true;
      }
    );
  });

  // Journey 12: Verify daily report
  test('Journey 12: Daily report shows correct metrics and individual readings', async () => {
    const report = await reportsApi.getDaily('2026-11-10');
    assert.strictEqual(report.date, '2026-11-10');
    assert.strictEqual(report.count, 4);
    assert.strictEqual(report.lowest, 104);
    assert.strictEqual(report.highest, 142);
    // (104 + 135 + 125 + 142) / 4 = 506 / 4 = 126.5
    assert.strictEqual(report.average, 126.5);
    assert.strictEqual(report.readings.length, 4);
  });

  // Journey 13: Verify month-to-date report
  test('Journey 13: Month-to-date report calculates from day 1 to selected date', async () => {
    const report = await reportsApi.getMonthToDate('2026-11-10');
    assert.strictEqual(report.start_date, '2026-11-01');
    assert.strictEqual(report.end_date, '2026-11-10');
    assert.strictEqual(report.count, 4);
    assert.strictEqual(report.lowest, 104);
    assert.strictEqual(report.highest, 142);
    assert.strictEqual(report.average, 126.5);
  });

  // Journey 14: Verify previous-month report
  test('Journey 14: Previous-month report calculates full previous calendar month', async () => {
    // Add 1 reading in October 2026
    await readingsApi.create('2026-10-15', 'Morning (fasting)', 90);

    const report = await reportsApi.getMonthly('2026-11-10');
    assert.strictEqual(report.start_date, '2026-10-01');
    assert.strictEqual(report.end_date, '2026-10-31');
    assert.strictEqual(report.count, 1);
    assert.strictEqual(report.highest, 90);
    assert.strictEqual(report.lowest, 90);
    assert.strictEqual(report.average, 90);
  });

  // Journey 15: Verify empty report states
  test('Journey 15: Empty report states return nulls and count 0 (not 404)', async () => {
    const emptyDaily = await reportsApi.getDaily('2026-11-01');
    assert.strictEqual(emptyDaily.count, 0);
    assert.strictEqual(emptyDaily.highest, null);
    assert.strictEqual(emptyDaily.lowest, null);
    assert.strictEqual(emptyDaily.average, null);
    assert.deepStrictEqual(emptyDaily.readings, []);

    const emptyMtd = await reportsApi.getMonthToDate('2026-08-15');
    assert.strictEqual(emptyMtd.count, 0);
    assert.strictEqual(emptyMtd.highest, null);
    assert.strictEqual(emptyMtd.lowest, null);
    assert.strictEqual(emptyMtd.average, null);
  });

  // Journey 16: Log out and verify protected pages are inaccessible
  test('Journey 16: Logout clears credentials and protected endpoints reject with 401', async () => {
    clearAuth();
    assert.strictEqual(getToken(), null);
    assert.strictEqual(getStoredUser(), null);

    await assert.rejects(
      async () => {
        await readingsApi.list();
      },
      (err) => {
        assert.strictEqual(err.status, 401);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await reportsApi.getDaily('2026-11-10');
      },
      (err) => {
        assert.strictEqual(err.status, 401);
        return true;
      }
    );
  });
});
