const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization format must be Bearer <token>' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('CRITICAL: JWT_SECRET is not configured in environment variables.');
      return res.status(500).json({ error: 'Internal server authentication error' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired' });
      }
      return res.status(401).json({ error: 'Invalid authorization token' });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid authorization token' });
    }

    // Attach verified identity strictly from the cryptographically verified JWT payload
    req.user = {
      id: decoded.id,
      email: decoded.email
    };

    next();
  } catch (error) {
    console.error('Authentication middleware unexpected error:', error.message);
    return res.status(500).json({ error: 'Authentication processing error' });
  }
}

module.exports = authMiddleware;
