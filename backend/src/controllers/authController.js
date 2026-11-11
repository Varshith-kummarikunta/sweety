const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const BCRYPT_SALT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new user
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { name, email, password } = req.body || {};

    // 1. Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // 2. Validate email format
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // 3. Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // 4. Check for duplicate email (case-insensitive)
    const existingUserRes = await query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existingUserRes.rows.length > 0) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    // 5. Hash password with bcrypt (salt rounds: 12)
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 6. Insert new user using parameterized query
    const insertRes = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [trimmedName, normalizedEmail, passwordHash]
    );

    const newUser = insertRes.rows[0];

    // 7. Sign JWT token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // 8. Return response without password_hash
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        created_at: newUser.created_at,
      },
      token,
    });
  } catch (error) {
    // Handle concurrent duplicate insertion caught by database unique index
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email is already registered' });
    }
    console.error('Error during registration:', error.message);
    return res.status(500).json({ error: 'Registration failed due to a server error' });
  }
}

/**
 * User login
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || !email.trim() || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Fetch user by normalized email
    const userRes = await query(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    // 2. Generic error response if user does not exist
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];

    // 3. Verify password with bcrypt.compare
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 4. Sign JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // 5. Return success payload without password_hash
    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
      },
      token,
    });
  } catch (error) {
    console.error('Error during login:', error.message);
    return res.status(500).json({ error: 'Login failed due to a server error' });
  }
}

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 */
async function getMe(req, res) {
  try {
    // req.user.id is strictly established by authMiddleware from the verified JWT
    const userRes = await query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      user: userRes.rows[0],
    });
  } catch (error) {
    console.error('Error retrieving current user:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve user profile' });
  }
}

module.exports = {
  register,
  login,
  getMe,
};
