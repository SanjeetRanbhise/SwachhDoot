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

// Get collector dashboard
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'COLLECTOR') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const assigned = await query(
      'SELECT * FROM complaints WHERE collector_id = $1 AND status IN ($2, $3, $4) ORDER BY created_at DESC',
      [req.user.id, 'ASSIGNED', 'IN_PROGRESS', 'CLEANED']
    );

    res.json({
      assigned: assigned.rows,
    });
  } catch (error) {
    console.error('Collector dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Get complaints assigned to collector
router.get('/complaints', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'COLLECTOR') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await query('SELECT * FROM complaints WHERE collector_id = $1 ORDER BY created_at DESC', [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get assigned complaints error:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

export default router;
