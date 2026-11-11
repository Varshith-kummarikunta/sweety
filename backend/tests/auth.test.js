const request = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const { pool, query } = require('../src/config/db');

describe('Milestone 3: Authentication API Integration Tests', () => {
  beforeAll(async () => {
    // Ensure test database schema is migrated
    const schemaSql = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
    await pool.query(schemaSql);
  });

  beforeEach(async () => {
    // Clean up test tables between tests for complete isolation
    await query('DELETE FROM users');
  });

  afterAll(async () => {
    // Clean up and close connection pool
    await query('DELETE FROM users');
    await pool.end();
  });

  // 1. Successful user registration
  test('1. Successful user registration returns 201 with user details and JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'SecurePassword123!',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user.name).toBe('Jane Doe');
    expect(res.body.user.email).toBe('jane@example.com');
    expect(res.body.user).toHaveProperty('created_at');
    expect(res.body.user.password_hash).toBeUndefined();
  });

  // 2. Password is stored as a bcrypt hash, not plaintext
  test('2. Password is stored in database as a bcrypt hash, never plaintext', async () => {
    const plainPassword = 'MySecretPassword123';
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Security Test',
        email: 'security@example.com',
        password: plainPassword,
      });

    const dbRes = await query('SELECT password_hash FROM users WHERE email = $1', ['security@example.com']);
    expect(dbRes.rows.length).toBe(1);

    const storedHash = dbRes.rows[0].password_hash;
    // Must not equal plaintext
    expect(storedHash).not.toBe(plainPassword);
    // Bcrypt hashes start with $2a$, $2b$, or $2y$ and have length 60
    expect(storedHash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  // 3. Duplicate email registration is rejected, including different email casing
  test('3. Duplicate email registration is rejected with 409, regardless of letter casing', async () => {
    // First registration
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User One',
        email: 'duplicate@example.com',
        password: 'Password123!',
      });
    expect(res1.status).toBe(201);

    // Attempt second registration with mixed uppercase
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User Two',
        email: 'DUPLICATE@EXAMPLE.COM',
        password: 'AnotherPassword123!',
      });

    expect(res2.status).toBe(409);
    expect(res2.body.error).toMatch(/already registered/i);
  });

  // 4. Missing or invalid registration fields are rejected
  test('4. Missing, empty, or invalid registration fields are rejected with 400', async () => {
    // Missing name
    const resNoName = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'Password123' });
    expect(resNoName.status).toBe(400);

    // Whitespace-only name
    const resEmptyName = await request(app)
      .post('/api/auth/register')
      .send({ name: '   ', email: 'test@example.com', password: 'Password123' });
    expect(resEmptyName.status).toBe(400);

    // Missing email
    const resNoEmail = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Valid Name', password: 'Password123' });
    expect(resNoEmail.status).toBe(400);

    // Invalid email format
    const resBadEmail = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Valid Name', email: 'not-an-email', password: 'Password123' });
    expect(resBadEmail.status).toBe(400);
    expect(resBadEmail.body.error).toMatch(/invalid email/i);

    // Missing password
    const resNoPass = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Valid Name', email: 'valid@example.com' });
    expect(resNoPass.status).toBe(400);

    // Short password (< 6 chars)
    const resShortPass = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Valid Name', email: 'valid@example.com', password: '123' });
    expect(resShortPass.status).toBe(400);
    expect(resShortPass.body.error).toMatch(/at least 6 characters/i);
  });

  // 5. Successful login with correct credentials
  test('5. Successful login returns 200 with user profile and valid JWT', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Login User',
        email: 'login@example.com',
        password: 'CorrectPassword123',
      });

    // Login with uppercase/mixed email to verify normalization
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'LOGIN@EXAMPLE.COM',
        password: 'CorrectPassword123',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    expect(loginRes.body.user.email).toBe('login@example.com');
    expect(loginRes.body.user.password_hash).toBeUndefined();
  });

  // 6. Incorrect password is rejected
  test('6. Incorrect password returns 401 with generic error message', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Wrong Pass User',
        email: 'wrongpass@example.com',
        password: 'RealPassword123',
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'wrongpass@example.com',
        password: 'WrongPassword456',
      });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.error).toBe('Invalid email or password');
  });

  // 7. Unknown email is rejected with the same generic response
  test('7. Unknown email returns 401 with identical generic response', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'AnyPassword123',
      });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.error).toBe('Invalid email or password');
  });

  // 8. Missing JWT is rejected on protected endpoint
  test('8. Missing Authorization header returns 401 on protected endpoint', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/token required/i);
  });

  // 9. Invalid JWT is rejected
  test('9. Invalid or malformed JWT returns 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.payload');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid authorization token/i);
  });

  // 10. Expired JWT is rejected
  test('10. Expired JWT returns 401 with expired message', async () => {
    const expiredToken = jwt.sign(
      { id: '11111111-1111-1111-1111-111111111111', email: 'expired@example.com' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expired/i);
  });

  // 11. Valid JWT can access /api/auth/me
  test('11. Valid JWT successfully accesses /api/auth/me', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Profile User',
        email: 'profile@example.com',
        password: 'MyPassword123!',
      });

    const token = regRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.name).toBe('Profile User');
    expect(meRes.body.user.email).toBe('profile@example.com');
    expect(meRes.body.user).toHaveProperty('id');
    expect(meRes.body.user).toHaveProperty('created_at');
    expect(meRes.body.user.password_hash).toBeUndefined();
  });

  // 12. Response never exposes password_hash
  test('12. Endpoints (register, login, me) never expose password_hash in response', async () => {
    // 1. Register
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'No Hash User',
        email: 'nohash@example.com',
        password: 'Password123!',
      });
    expect(regRes.body.user.password_hash).toBeUndefined();

    // 2. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nohash@example.com',
        password: 'Password123!',
      });
    expect(loginRes.body.user.password_hash).toBeUndefined();

    // 3. Me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(meRes.body.user.password_hash).toBeUndefined();
  });

  // 13. User identity comes strictly from token, never client-supplied ID
  test('13. User identity comes from verified token, ignoring client-supplied user IDs', async () => {
    // Create User A
    const userARes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice User',
        email: 'alice@example.com',
        password: 'AlicePassword123',
      });
    const aliceToken = userARes.body.token;

    // Create User B
    const userBRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Bob User',
        email: 'bob@example.com',
        password: 'BobPassword123',
      });
    const bobId = userBRes.body.user.id;

    // Alice requests /api/auth/me while tampering query/body with Bob's ID
    const res = await request(app)
      .get(`/api/auth/me?user_id=${bobId}&id=${bobId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ user_id: bobId, id: bobId });

    expect(res.status).toBe(200);
    // Must return Alice, NOT Bob
    expect(res.body.user.name).toBe('Alice User');
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.id).toBe(userARes.body.user.id);
    expect(res.body.user.id).not.toBe(bobId);
  });
});
