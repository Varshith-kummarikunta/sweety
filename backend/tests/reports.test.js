const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { pool, query } = require('../src/config/db');

describe('Milestone 5: Glucose Reporting Engine Integration Tests', () => {
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;

  beforeAll(async () => {
    // Ensure test database schema is migrated
    const schemaSql = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
    await pool.query(schemaSql);
  });

  beforeEach(async () => {
    // Clear test tables
    await query('DELETE FROM readings');
    await query('DELETE FROM users');

    // Register User 1
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Reporter One',
        email: 'reporter1@test.com',
        password: 'Password123!',
      });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    // Register User 2
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Reporter Two',
        email: 'reporter2@test.com',
        password: 'Password123!',
      });
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  });

  afterAll(async () => {
    await query('DELETE FROM readings');
    await query('DELETE FROM users');
    await pool.end();
  });

  // 1. Unauthenticated requests cannot access daily reports
  test('1. Unauthenticated requests cannot access daily reports', async () => {
    const res = await request(app).get('/api/reports/daily?date=2026-11-10');
    expect(res.status).toBe(401);
  });

  // 2. Unauthenticated requests cannot access month-to-date reports
  test('2. Unauthenticated requests cannot access month-to-date reports', async () => {
    const res = await request(app).get('/api/reports/month-to-date?date=2026-11-10');
    expect(res.status).toBe(401);
  });

  // 3. Unauthenticated requests cannot access monthly reports
  test('3. Unauthenticated requests cannot access monthly reports', async () => {
    const res = await request(app).get('/api/reports/monthly?date=2026-11-10');
    expect(res.status).toBe(401);
  });

  // 4. Daily report correctly calculates highest, lowest, average, and count
  test('4. Daily report correctly calculates highest, lowest, average, and count', async () => {
    const testDate = '2026-11-10';
    // Insert 3 readings: 90, 115, 140 -> average: (90 + 115 + 140) / 3 = 115.0
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: testDate, time_slot: 'Morning (fasting)', value: 90 });

    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: testDate, time_slot: 'After lunch', value: 115 });

    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: testDate, time_slot: 'After dinner', value: 140 });

    const res = await request(app)
      .get(`/api/reports/daily?date=${testDate}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBe(testDate);
    expect(res.body.highest).toBe(140);
    expect(res.body.lowest).toBe(90);
    expect(res.body.average).toBe(115);
    expect(res.body.count).toBe(3);
  });

  // 5. Daily report includes individual readings and their time slots
  test('5. Daily report includes individual readings and their time slots in slot order', async () => {
    const testDate = '2026-11-10';
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: testDate, time_slot: 'After dinner', value: 150 });

    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: testDate, time_slot: 'Morning (fasting)', value: 95 });

    const res = await request(app)
      .get(`/api/reports/daily?date=${testDate}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.readings)).toBe(true);
    expect(res.body.readings.length).toBe(2);
    // Morning (fasting) should appear before After dinner
    expect(res.body.readings[0].time_slot).toBe('Morning (fasting)');
    expect(res.body.readings[0].value).toBe(95);
    expect(res.body.readings[1].time_slot).toBe('After dinner');
    expect(res.body.readings[1].value).toBe(150);
  });

  // 6. Month-to-date includes readings from the first day through the selected date
  test('6. Month-to-date includes readings from 1st day through selected date', async () => {
    // Nov 1
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-11-01', time_slot: 'Morning (fasting)', value: 100 });

    // Nov 5
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-11-05', time_slot: 'Morning (fasting)', value: 120 });

    // Nov 10 (selected date)
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-11-10', time_slot: 'Morning (fasting)', value: 110 });

    const res = await request(app)
      .get('/api/reports/month-to-date?date=2026-11-10')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.start_date).toBe('2026-11-01');
    expect(res.body.end_date).toBe('2026-11-10');
    expect(res.body.count).toBe(3);
    expect(res.body.highest).toBe(120);
    expect(res.body.lowest).toBe(100);
    expect(res.body.average).toBe(110);
  });

  // 7. Month-to-date excludes readings after the selected date
  test('7. Month-to-date excludes readings after the selected date', async () => {
    // Nov 5 (inside MTD window)
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-11-05', time_slot: 'Morning (fasting)', value: 100 });

    // Nov 10 (selected date)
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-11-10', time_slot: 'Morning (fasting)', value: 110 });

    // Nov 11 (after selected date)
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-11-11', time_slot: 'Morning (fasting)', value: 250 });

    const res = await request(app)
      .get('/api/reports/month-to-date?date=2026-11-10')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    // Highest should be 110, not 250
    expect(res.body.highest).toBe(110);
  });

  // 8. Previous-month report includes the entire previous calendar month
  test('8. Previous-month report includes entire previous calendar month (e.g. October)', async () => {
    // Oct 1 (first day of Oct)
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-10-01', time_slot: 'Morning (fasting)', value: 85 });

    // Oct 15
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-10-15', time_slot: 'After lunch', value: 140 });

    // Oct 31 (last day of Oct)
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-10-31', time_slot: 'After dinner', value: 165 });

    const res = await request(app)
      .get('/api/reports/monthly?date=2026-11-10')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.start_date).toBe('2026-10-01');
    expect(res.body.end_date).toBe('2026-10-31');
    expect(res.body.count).toBe(3);
    expect(res.body.highest).toBe(165);
    expect(res.body.lowest).toBe(85);
    expect(res.body.average).toBe(130);
  });

  // 9. Previous-month report excludes current-month readings
  test('9. Previous-month report excludes current-month readings', async () => {
    // October reading (should be included)
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-10-20', time_slot: 'Morning (fasting)', value: 100 });

    // November reading (current month - must be excluded)
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-11-05', time_slot: 'Morning (fasting)', value: 200 });

    const res = await request(app)
      .get('/api/reports/monthly?date=2026-11-10')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.highest).toBe(100);
  });

  // 10. January selection correctly calculates the previous December across years
  test('10. January selection calculates previous December across years (e.g. 2026-01 -> 2025-12)', async () => {
    // Dec 15, 2025
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2025-12-15', time_slot: 'Morning (fasting)', value: 110 });

    const res = await request(app)
      .get('/api/reports/monthly?date=2026-01-15')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.start_date).toBe('2025-12-01');
    expect(res.body.end_date).toBe('2025-12-31');
    expect(res.body.count).toBe(1);
    expect(res.body.highest).toBe(110);
  });

  // 11. Average is rounded to exactly one decimal place
  test('11. Average is rounded to exactly one decimal place', async () => {
    const testDate = '2026-11-10';
    // 100, 105, 112 -> sum = 317, avg = 317 / 3 = 105.6666... -> 105.7
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: testDate, time_slot: 'Morning (fasting)', value: 100 });
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: testDate, time_slot: 'After breakfast', value: 105 });
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: testDate, time_slot: 'After lunch', value: 112 });

    const res = await request(app)
      .get(`/api/reports/daily?date=${testDate}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.average).toBe(105.7);
  });

  // 12. Empty daily report returns null statistics, count 0, and an empty readings array
  test('12. Empty daily report returns null statistics, count 0, and empty readings array', async () => {
    const res = await request(app)
      .get('/api/reports/daily?date=2026-11-08')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-11-08');
    expect(res.body.highest).toBeNull();
    expect(res.body.lowest).toBeNull();
    expect(res.body.average).toBeNull();
    expect(res.body.count).toBe(0);
    expect(res.body.readings).toEqual([]);
  });

  // 13. Empty month-to-date report returns the correct empty statistics
  test('13. Empty month-to-date report returns correct empty statistics', async () => {
    const res = await request(app)
      .get('/api/reports/month-to-date?date=2026-08-15')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.start_date).toBe('2026-08-01');
    expect(res.body.end_date).toBe('2026-08-15');
    expect(res.body.highest).toBeNull();
    expect(res.body.lowest).toBeNull();
    expect(res.body.average).toBeNull();
    expect(res.body.count).toBe(0);
  });

  // 14. Empty previous-month report returns the correct empty statistics
  test('14. Empty previous-month report returns correct empty statistics', async () => {
    const res = await request(app)
      .get('/api/reports/monthly?date=2026-08-15')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.start_date).toBe('2026-07-01');
    expect(res.body.end_date).toBe('2026-07-31');
    expect(res.body.highest).toBeNull();
    expect(res.body.lowest).toBeNull();
    expect(res.body.average).toBeNull();
    expect(res.body.count).toBe(0);
  });

  // 15. Invalid date format is rejected
  test('15. Invalid date format is rejected with 400', async () => {
    const res = await request(app)
      .get('/api/reports/daily?date=10-11-2026')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please provide a valid date in YYYY-MM-DD format.');
  });

  // 16. Invalid calendar date is rejected
  test('16. Invalid calendar date (e.g. 2026-02-30) is rejected with 400', async () => {
    const res = await request(app)
      .get('/api/reports/daily?date=2026-02-30')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please provide a valid date in YYYY-MM-DD format.');
  });

  // 17. Future date is rejected with exact required message
  test('17. Future date is rejected with "Date cannot be in the future."', async () => {
    const res = await request(app)
      .get('/api/reports/daily?date=2099-12-31')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Date cannot be in the future.');
  });

  // 18. Daily report never includes another user's readings
  test('18. Daily report never includes another user\'s readings', async () => {
    const testDate = '2026-11-10';
    // User 1 reading: 100
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: testDate, time_slot: 'Morning (fasting)', value: 100 });

    // User 2 reading on same date: 200
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ reading_date: testDate, time_slot: 'Morning (fasting)', value: 200 });

    const res1 = await request(app)
      .get(`/api/reports/daily?date=${testDate}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res1.body.count).toBe(1);
    expect(res1.body.highest).toBe(100);
    expect(res1.body.readings[0].user_id).toBe(user1Id);
  });

  // 19. Month-to-date never includes another user's readings
  test('19. Month-to-date never includes another user\'s readings', async () => {
    // User 1: 1 reading
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-11-05', time_slot: 'Morning (fasting)', value: 95 });

    // User 2: 1 reading
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ reading_date: '2026-11-05', time_slot: 'Morning (fasting)', value: 300 });

    const res1 = await request(app)
      .get('/api/reports/month-to-date?date=2026-11-10')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res1.body.count).toBe(1);
    expect(res1.body.highest).toBe(95);
  });

  // 20. Previous-month report never includes another user's readings
  test('20. Previous-month report never includes another user\'s readings', async () => {
    // User 1: 1 reading in October
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: '2026-10-15', time_slot: 'Morning (fasting)', value: 90 });

    // User 2: 1 reading in October
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ reading_date: '2026-10-15', time_slot: 'Morning (fasting)', value: 350 });

    const res1 = await request(app)
      .get('/api/reports/monthly?date=2026-11-10')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res1.body.count).toBe(1);
    expect(res1.body.highest).toBe(90);
  });

  // 21. Client-supplied user IDs cannot change report ownership
  test('21. Client-supplied user IDs cannot change report ownership', async () => {
    const testDate = '2026-11-10';
    // User 1 reading: 100
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: testDate, time_slot: 'Morning (fasting)', value: 100 });

    // User 2 reading: 200
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ reading_date: testDate, time_slot: 'Morning (fasting)', value: 200 });

    // User 1 attempts to pass User 2's ID in query
    const res = await request(app)
      .get(`/api/reports/daily?date=${testDate}&user_id=${user2Id}&userId=${user2Id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.highest).toBe(100);
    expect(res.body.readings[0].user_id).toBe(user1Id);
    expect(res.body.readings[0].user_id).not.toBe(user2Id);
  });
});
