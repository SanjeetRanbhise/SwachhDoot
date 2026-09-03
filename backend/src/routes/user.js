import { query } from '../db.js';
import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Get user dashboard stats
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'USER') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('REPORTED', 'ASSIGNED', 'IN_PROGRESS') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status IN ('CLEANED', 'VERIFIED', 'CLOSED') THEN 1 ELSE 0 END) as resolved
       FROM complaints WHERE user_id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0] || { total: 0, active: 0, resolved: 0 });
  } catch (error) {
    console.error('User dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

export default router;
