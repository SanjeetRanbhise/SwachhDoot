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

// Get admin dashboard data
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const stats = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'REPORTED' THEN 1 ELSE 0 END) as reported,
        SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'CLEANED' THEN 1 ELSE 0 END) as cleaned,
        SUM(CASE WHEN status = 'VERIFIED' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed
       FROM complaints`
    );

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Get all complaints
router.get('/complaints', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await query(
      `SELECT c.*, u.name as user_name, coll.name as collector_name
       FROM complaints c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users coll ON c.collector_id = coll.id
       ORDER BY c.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Assign collector to complaint
router.put('/complaints/:id/assign', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { collector_id } = req.body;
    if (!collector_id) {
      return res.status(400).json({ error: 'Collector ID required' });
    }

    const result = await query(
      'UPDATE complaints SET collector_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [collector_id, 'ASSIGNED', req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Assign error:', error);
    res.status(500).json({ error: 'Failed to assign complaint' });
  }
});

// Get all collectors
router.get('/collectors', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await query('SELECT id, name, email FROM users WHERE role = $1', ['COLLECTOR']);
    res.json(result.rows);
  } catch (error) {
    console.error('Get collectors error:', error);
    res.status(500).json({ error: 'Failed to fetch collectors' });
  }
});

export default router;
