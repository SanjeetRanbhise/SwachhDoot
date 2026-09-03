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

// Create feedback
router.post('/', verifyToken, async (req, res) => {
  try {
    const { complaint_id, rating, comment } = req.body;

    if (!complaint_id || !rating) {
      return res.status(400).json({ error: 'Complaint ID and rating required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const result = await query(
      'INSERT INTO feedback (complaint_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *',
      [complaint_id, req.user.id, rating, comment || null]
    );

    // Update complaint status to VERIFIED
    await query('UPDATE complaints SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['VERIFIED', complaint_id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

// Get feedback for admin
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await query(
      `SELECT f.*, c.complaint_id, u.name as user_name
       FROM feedback f
       JOIN complaints c ON f.complaint_id = c.id
       JOIN users u ON f.user_id = u.id
       ORDER BY f.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

export default router;
