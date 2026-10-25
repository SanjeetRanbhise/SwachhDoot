import { query } from '../db.js';
import express from 'express';
import { verifyToken, requireRole } from './auth.js';

const router = express.Router();
// Get user dashboard stats
router.get('/dashboard', verifyToken, requireRole('USER'), async (req, res) => {
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
