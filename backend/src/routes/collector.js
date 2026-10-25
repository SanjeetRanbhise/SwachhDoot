import { query } from '../db.js';
import express from 'express';
import { verifyToken, requireRole } from './auth.js';

const router = express.Router();
// Get collector dashboard
router.get('/dashboard', verifyToken, requireRole('COLLECTOR'), async (req, res) => {
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
router.get('/complaints', verifyToken, requireRole('COLLECTOR'), async (req, res) => {
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
