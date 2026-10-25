import { query } from '../db.js';
import express from 'express';
import { verifyToken, requireRole } from './auth.js';
import { isDescriptiveTextTooLong } from '../validation.js';

const router = express.Router();
// Create feedback
router.post('/', verifyToken, requireRole('USER'), async (req, res) => {
  try {
    const {
  complaint_id,
  rating,
  comment,
  waste_removed,
  area_left_clean,
  resolved_on_time,
} = req.body;

    if (isDescriptiveTextTooLong(comment)) {
      return res.status(400).json({ error: 'Feedback comment must be 160 characters or fewer' });
    }
    if (!complaint_id || !rating) {
      return res.status(400).json({ error: 'Complaint ID and rating required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const complaint = await query(
      `SELECT id, user_id, status FROM complaints
       WHERE id = CASE WHEN $1 ~ '^[0-9]+$' THEN $1::INTEGER ELSE NULL END
          OR complaint_id = $1
       LIMIT 1`,
      [String(complaint_id)]
    );
  
if (!complaint.rows.length) {
  return res.status(404).json({ error: 'Complaint not found' });
}

const complaintRecord = complaint.rows[0];

if (String(complaintRecord.user_id) !== String(req.user.id)) {
  return res.status(403).json({
    error: 'You can only verify your own complaint'
  });
}

if (!['CLEANED', 'VERIFIED'].includes(complaintRecord.status)) {
  return res.status(400).json({
    error: 'Complaint must be cleaned before verification'
  });
}

const dbComplaintId = complaintRecord.id;

const existing = await query(
  'SELECT id FROM feedback WHERE complaint_id = $1',
  [dbComplaintId]
);

if (existing.rows.length) {
  return res.status(409).json({
    error: 'Feedback has already been submitted'
  });
}


if (
  typeof waste_removed !== 'boolean' ||
  typeof area_left_clean !== 'boolean' ||
  typeof resolved_on_time !== 'boolean'
) {
  return res.status(400).json({
    error: 'Please answer all three Yes/No questions.',
  });
}

const yesCount = [
  waste_removed,
  area_left_clean,
  resolved_on_time,
].filter(Boolean).length;

const overallFeedback =
  yesCount === 3 ? 'Good' :
  yesCount === 2 ? 'Average' :
  'Poor';

const result = await query(
  `INSERT INTO feedback (
    complaint_id,
    user_id,
    rating,
    comment,
    waste_removed,
    area_left_clean,
    resolved_on_time,
    overall_feedback
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *`,
  [
    dbComplaintId,
    req.user.id,
    rating,
    comment || null,
    waste_removed,
    area_left_clean,
    resolved_on_time,
    overallFeedback,
  ]
);



    // Update complaint status to VERIFIED
   await query(
  'UPDATE complaints SET status = $1, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
  ['VERIFIED', dbComplaintId]
   );
    await query(
  'INSERT INTO complaint_status_history (complaint_id, status, performed_by, performed_role) VALUES ($1, $2, $3, $4)',
  [dbComplaintId, 'VERIFIED', req.user.id, 'USER']
);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

// Get feedback for admin
router.get('/admin/all', verifyToken, requireRole('ADMIN'), async (req, res) => {
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
