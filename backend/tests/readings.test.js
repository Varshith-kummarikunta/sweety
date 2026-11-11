const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { pool, query } = require('../src/config/db');

describe('Milestone 4: Blood Glucose Readings CRUD Integration Tests', () => {
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;

  const validPastDate = '2026-11-10';
  const anotherPastDate = '2026-11-09';

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
        name: 'User One',
        email: 'user1@readingstest.com',
        password: 'Password123!',
      });
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    // Register User 2
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User Two',
        email: 'user2@readingstest.com',
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

  // 1. Unauthenticated user cannot list readings
  test('1. Unauthenticated user cannot list readings', async () => {
    const res = await request(app).get('/api/readings');
    expect(res.status).toBe(401);
  });

  // 2. Unauthenticated user cannot create a reading
  test('2. Unauthenticated user cannot create a reading', async () => {
    const res = await request(app)
      .post('/api/readings')
      .send({
        reading_date: validPastDate,
        time_slot: 'Morning (fasting)',
        value: 100,
      });
    expect(res.status).toBe(401);
  });

  // 3. Successful reading creation
  test('3. Successful reading creation returns 201 and reading payload', async () => {
    const res = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: validPastDate,
        time_slot: 'Morning (fasting)',
        value: 105,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('reading');
    expect(res.body.reading.value).toBe(105);
    expect(res.body.reading.time_slot).toBe('Morning (fasting)');
    expect(res.body.reading.reading_date).toBe(validPastDate);
    expect(res.body.reading.user_id).toBe(user1Id);
  });

  // 4. Successful listing of the authenticated user's readings
  test('4. Successful listing of the authenticated user\'s readings in chronological slot order', async () => {
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'After lunch', value: 130 });

    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 95 });

    const res = await request(app)
      .get('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.readings.length).toBe(2);
    // Morning (fasting) should precede After lunch
    expect(res.body.readings[0].time_slot).toBe('Morning (fasting)');
    expect(res.body.readings[1].time_slot).toBe('After lunch');
  });

  // 5. Listing never returns another user's readings
  test('5. Listing never returns another user\'s readings', async () => {
    // User 1 creates reading
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 90 });

    // User 2 creates reading
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 120 });

    // User 1 lists readings
    const res1 = await request(app)
      .get('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`);
    expect(res1.body.readings.length).toBe(1);
    expect(res1.body.readings[0].value).toBe(90);

    // User 2 lists readings
    const res2 = await request(app)
      .get('/api/readings')
      .set('Authorization', `Bearer ${user2Token}`);
    expect(res2.body.readings.length).toBe(1);
    expect(res2.body.readings[0].value).toBe(120);
  });

  // 6. Successful retrieval of an owned reading
  test('6. Successful retrieval of an owned reading', async () => {
    const createRes = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'After dinner', value: 140 });

    const readingId = createRes.body.reading.id;

    const getRes = await request(app)
      .get(`/api/readings/${readingId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.reading.id).toBe(readingId);
    expect(getRes.body.reading.value).toBe(140);
  });

  // 7. Another user's reading returns 404
  test('7. Another user\'s reading returns 404 on GET by id', async () => {
    const createRes = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'After dinner', value: 140 });

    const readingId = createRes.body.reading.id;

    // User 2 tries to access User 1's reading
    const getRes = await request(app)
      .get(`/api/readings/${readingId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.error).toBe('Reading not found');
  });

  // 8. Successful reading update
  test('8. Successful reading update', async () => {
    const createRes = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 95 });

    const readingId = createRes.body.reading.id;

    const updateRes = await request(app)
      .put(`/api/readings/${readingId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: validPastDate,
        time_slot: 'Morning (fasting)',
        value: 102,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.reading.value).toBe(102);
  });

  // 9. Another user's reading cannot be updated
  test('9. Another user\'s reading cannot be updated (returns 404)', async () => {
    const createRes = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 95 });

    const readingId = createRes.body.reading.id;

    // User 2 attempts update
    const updateRes = await request(app)
      .put(`/api/readings/${readingId}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        reading_date: validPastDate,
        time_slot: 'Morning (fasting)',
        value: 199,
      });

    expect(updateRes.status).toBe(404);
    expect(updateRes.body.error).toBe('Reading not found');
  });

  // 10. Successful reading deletion
  test('10. Successful reading deletion', async () => {
    const createRes = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 95 });

    const readingId = createRes.body.reading.id;

    const deleteRes = await request(app)
      .delete(`/api/readings/${readingId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toMatch(/deleted successfully/i);

    // Verify it is gone
    const getRes = await request(app)
      .get(`/api/readings/${readingId}`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(getRes.status).toBe(404);
  });

  // 11. Another user's reading cannot be deleted
  test('11. Another user\'s reading cannot be deleted (returns 404)', async () => {
    const createRes = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 95 });

    const readingId = createRes.body.reading.id;

    // User 2 attempts delete
    const deleteRes = await request(app)
      .delete(`/api/readings/${readingId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.error).toBe('Reading not found');

    // Confirm User 1 still has the reading
    const getRes = await request(app)
      .get(`/api/readings/${readingId}`)
      .set('Authorization', `Bearer ${user1Token}`);
    expect(getRes.status).toBe(200);
  });

  // 12. Missing value returns exact required message
  test('12. Missing value returns "Please enter a glucose value."', async () => {
    const res = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: validPastDate,
        time_slot: 'Morning (fasting)',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please enter a glucose value.');
  });

  // 13. Decimal value is rejected
  test('13. Decimal value is rejected with "Value must be between 40 and 600 mg/dl."', async () => {
    const res = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: validPastDate,
        time_slot: 'Morning (fasting)',
        value: 120.5,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Value must be between 40 and 600 mg/dl.');
  });

  // 14. Values 39 and 601 are rejected with exact required message
  test('14. Out-of-range values (39 and 601) return "Value must be between 40 and 600 mg/dl."', async () => {
    // 39
    const resLow = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 39 });
    expect(resLow.status).toBe(400);
    expect(resLow.body.error).toBe('Value must be between 40 and 600 mg/dl.');

    // 601
    const resHigh = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 601 });
    expect(resHigh.status).toBe(400);
    expect(resHigh.body.error).toBe('Value must be between 40 and 600 mg/dl.');
  });

  // 15. Invalid time slot is rejected
  test('15. Invalid time slot is rejected', async () => {
    const res = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: validPastDate,
        time_slot: 'Midnight Snack',
        value: 100,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid time slot/i);
  });

  // 16. Duplicate slot/date returns exact required message
  test('16. Duplicate slot/date returns exact required message', async () => {
    await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: validPastDate,
        time_slot: 'After lunch',
        value: 130,
      });

    const res = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: validPastDate,
        time_slot: 'After lunch',
        value: 135,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You already have an After lunch reading for this date.');
  });

  // 17. Fifth reading on same date returns exact maximum-daily message
  test('17. Fifth reading on the same date returns "You can add only 4 readings per day."', async () => {
    const slots = ['Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner'];
    for (const slot of slots) {
      const res = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ reading_date: validPastDate, time_slot: slot, value: 110 });
      expect(res.status).toBe(201);
    }

    // Attempt 5th reading
    const fifthRes = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'After lunch', value: 120 });

    expect(fifthRes.status).toBe(400);
    expect(fifthRes.body.error).toBe('You can add only 4 readings per day.');
  });

  // 18. Future date returns exact required message
  test('18. Future date returns "Date cannot be in the future."', async () => {
    const res = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: '2099-12-31',
        time_slot: 'Morning (fasting)',
        value: 95,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Date cannot be in the future.');
  });

  // 19. Invalid calendar date is rejected
  test('19. Invalid calendar date (e.g. 2026-02-30) is rejected', async () => {
    const res = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: '2026-02-30',
        time_slot: 'Morning (fasting)',
        value: 95,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid calendar date/i);
  });

  // 20. Editing a reading does not incorrectly count itself against the daily limit
  test('20. Editing a reading on a date with 4 readings does not exceed daily limit', async () => {
    const slots = ['Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner'];
    let breakfastReadingId;

    for (const slot of slots) {
      const res = await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ reading_date: validPastDate, time_slot: slot, value: 110 });
      if (slot === 'After breakfast') {
        breakfastReadingId = res.body.reading.id;
      }
    }

    // Update value of breakfast reading without changing date or slot
    const updateRes = await request(app)
      .put(`/api/readings/${breakfastReadingId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: validPastDate,
        time_slot: 'After breakfast',
        value: 125,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.reading.value).toBe(125);
  });

  // 21. Moving a reading to a date that already has four readings is rejected
  test('21. Moving a reading to a date that already has four readings is rejected', async () => {
    // Fill validPastDate with 4 readings
    const slots = ['Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner'];
    for (const slot of slots) {
      await request(app)
        .post('/api/readings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ reading_date: validPastDate, time_slot: slot, value: 100 });
    }

    // Create 1 reading on anotherPastDate
    const singleRes = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: anotherPastDate, time_slot: 'Morning (fasting)', value: 100 });
    const singleReadingId = singleRes.body.reading.id;

    // Try to move reading to validPastDate (which already has 4)
    const moveRes = await request(app)
      .put(`/api/readings/${singleReadingId}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        reading_date: validPastDate,
        time_slot: 'Morning (fasting)',
        value: 105,
      });

    expect(moveRes.status).toBe(400);
    expect(moveRes.body.error).toBe('You can add only 4 readings per day.');
  });

  // 22. Concurrent create requests cannot exceed four readings per user/date
  test('22. Concurrent create requests cannot exceed four readings per user/date', async () => {
    // Fire 6 concurrent requests for the same date with different slots/values
    const requestSlots = [
      'Morning (fasting)',
      'After breakfast',
      'After lunch',
      'After dinner',
      'Morning (fasting)',
      'After breakfast',
    ];

    const responses = await Promise.all(
      requestSlots.map(slot =>
        request(app)
          .post('/api/readings')
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ reading_date: validPastDate, time_slot: slot, value: 110 })
      )
    );

    const successful = responses.filter(r => r.status === 201);
    const rejected = responses.filter(r => r.status === 400);

    // Exactly 4 should succeed, 2 must be rejected
    expect(successful.length).toBe(4);
    expect(rejected.length).toBe(2);

    // Check actual database count
    const countDb = await query(
      'SELECT COUNT(*)::int AS count FROM readings WHERE user_id = $1 AND reading_date = $2',
      [user1Id, validPastDate]
    );
    expect(countDb.rows[0].count).toBe(4);
  });

  // 23. Different user can independently create readings for the same date and slot
  test('23. Different user can independently create readings for the same date and slot', async () => {
    const res1 = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 92 });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ reading_date: validPastDate, time_slot: 'Morning (fasting)', value: 115 });
    expect(res2.status).toBe(201);
    expect(res2.body.reading.user_id).toBe(user2Id);
  });
});
