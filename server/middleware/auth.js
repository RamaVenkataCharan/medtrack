// server/middleware/auth.js
const { supabase } = require('../db/supabaseClient');

/**
 * Authentication Middleware using Supabase Auth (JWT token verification)
 * Expects header: "Authorization: Bearer <token>"
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // In development / local testing without strict auth requirement, allow requests without token
  if (!authHeader && process.env.REQUIRE_AUTH !== 'true') {
    req.user = { id: 'dev-pharmacist', phone: '+919848012345' };
    return next();
  }

  if (process.env.REQUIRE_AUTH === 'false') {
    req.user = { id: 'dev-pharmacist', phone: '+919848012345' };
    return next();
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or malformed Authorization header. Expected Bearer token.',
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return res.status(401).json({ error: 'Auth token is empty' });
    }

    // Verify token with Supabase Auth
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data || !data.user) {
      return res.status(401).json({
        error: 'Invalid or expired authentication token',
        details: error ? error.message : 'User not found',
      });
    }

    // Attach authenticated user details to request
    req.user = data.user;
    req.userId = data.user.id;
    req.phoneNumber = data.user.phone;

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal error during authentication verification' });
  }
}

module.exports = { authMiddleware };
