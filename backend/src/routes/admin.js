import { getClient, query } from '../db.js';
import express from 'express';
import { verifyToken, requireRole, requirePrimaryAdmin } from './auth.js';

const router = express.Router();
const canonicalStatuses = ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'VERIFIED', 'CLOSED'];

const formatDateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getReportRange = (type, dateValue) => {
  const selectedDate = dateValue || formatDateOnly(new Date());
  if (type === 'monthly') {
    const [year, month] = selectedDate.split('-').map(Number);
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);
    return {
      start: formatDateOnly(start),
      end: formatDateOnly(end),
      label: `${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(start)}`,
    };
  }

  const base = new Date(`${selectedDate}T00:00:00`);
  const day = base.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return {
    start: formatDateOnly(start),
    end: formatDateOnly(end),
    label: `${formatDateOnly(start)} – ${formatDateOnly(end)}`,
  };
};

// Get admin dashboard data
router.get('/dashboard', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
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
router.get('/complaints', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { status, waste_type, location } = req.query;
    const values = [];
    const filters = [];
    if (status && canonicalStatuses.includes(status)) { values.push(status); filters.push(`c.status = $${values.length}`); }
    if (waste_type) { values.push(waste_type); filters.push(`c.waste_type = $${values.length}`); }
    if (location) { values.push(`%${location}%`); filters.push(`c.address ILIKE $${values.length}`); }
    const result = await query(
      `SELECT c.*, u.name as user_name, coll.name as collector_name, f.rating, f.comment AS feedback, f.created_at AS feedback_created_at
       FROM complaints c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users coll ON c.collector_id = coll.id
       LEFT JOIN feedback f ON f.complaint_id = c.id
       ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
       ORDER BY c.created_at DESC`, values
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Assign collector to complaint

router.put('/complaints/:id/assign', verifyToken, requireRole('ADMIN'), async (req, res) => {
  const client = await getClient();
  try {
    const { collector_id, expected_cleaning_hours } = req.body;
    const cleaningHours = Number(expected_cleaning_hours);

    if (!collector_id) {
      return res.status(400).json({ error: 'Collector ID required' });
    }

    if (!Number.isInteger(cleaningHours) || ![6, 12, 24, 48, 72].includes(cleaningHours)) {
      return res.status(400).json({ error: 'Select a valid cleaning deadline' });
    }

    const collector = await query(
      'SELECT id FROM users WHERE id = $1 AND role = $2 AND is_verified = TRUE',
      [collector_id, 'COLLECTOR']
    );

    if (!collector.rows.length) {
      return res.status(400).json({ error: 'Invalid waste management team account' });
    }

    await client.query('BEGIN');

    const result = await client.query(
  `UPDATE complaints
   SET collector_id = $1,
       assigned_by = $2,
       expected_cleaning_hours = $3::integer,
       expected_cleaning_at = CURRENT_TIMESTAMP
         + ($3::integer * INTERVAL '1 hour'),
       status = 'ASSIGNED',
       updated_at = CURRENT_TIMESTAMP
   WHERE id = $4 AND status = 'REPORTED'
   RETURNING *`,
  [collector_id, req.user.id, cleaningHours, req.params.id]
);

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Complaint not found or already assigned' });
    }

    await client.query(
      `INSERT INTO complaint_status_history
       (complaint_id, status, performed_by, performed_role)
       VALUES ($1, 'ASSIGNED', $2, 'ADMIN')`,
      [result.rows[0].id, req.user.id]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Assign error:', error);
    res.status(500).json({ error: 'Failed to assign complaint' });
  } finally {
    client.release();
  }
});

// Get all collectors
router.get('/collectors', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const result = await query('SELECT id, name, email FROM users WHERE role = $1', ['COLLECTOR']);
    res.json(result.rows);
  } catch (error) {
    console.error('Get collectors error:', error);
    res.status(500).json({ error: 'Failed to fetch collectors' });
  }
});

router.get('/admins', verifyToken, requireRole('ADMIN'), requirePrimaryAdmin, async (req, res) => {
  const result = await query("SELECT id, name, email, phone, address, admin_status, is_primary_admin, approved_at, rejected_at, created_at FROM users WHERE role = 'ADMIN' ORDER BY CASE admin_status WHEN 'PENDING' THEN 1 WHEN 'APPROVED' THEN 2 ELSE 3 END, created_at");
  res.json(result.rows);
});

router.get('/approval-requests', verifyToken, requireRole('ADMIN'), requirePrimaryAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT request.id, request.admin_user_id, account.name, account.email, account.phone,
        request.requested_at, request.status
       FROM admin_approval_requests request
       JOIN users account ON account.id = request.admin_user_id
       WHERE request.status = 'PENDING' AND account.role = 'ADMIN' AND account.admin_status = 'PENDING'
       ORDER BY request.requested_at, request.id`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get admin approval requests error:', error);
    res.status(500).json({ error: 'Failed to fetch Admin approval requests' });
  }
});

router.get('/notifications', verifyToken, requireRole('ADMIN'), requirePrimaryAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, complaint_id, message, is_read, created_at
       FROM notifications
       WHERE collector_id = $1 AND complaint_id IS NOT NULL
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({
      count: result.rows.filter((row) => !row.is_read).length,
      notifications: result.rows,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.put('/notifications/read', verifyToken, requireRole('ADMIN'), requirePrimaryAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.notificationIds) ? req.body.notificationIds.map(Number).filter(Boolean) : [];
    if (!ids.length) return res.json({ updated: 0 });

    await query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ANY($1::int[]) AND collector_id = $2',
      [ids, req.user.id]
    );
    res.json({ updated: ids.length });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

router.put('/admins/:id/approve', verifyToken, requireRole('ADMIN'), requirePrimaryAdmin, async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const request = await client.query(
      "UPDATE admin_approval_requests SET status = 'APPROVED', decided_by = $1, decided_at = CURRENT_TIMESTAMP WHERE admin_user_id = $2 AND status = 'PENDING' RETURNING id",
      [req.user.id, req.params.id]
    );
    if (!request.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending admin approval request not found' });
    }
    const result = await client.query(
      "UPDATE users SET is_verified = TRUE, admin_status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, rejected_by = NULL, rejected_at = NULL WHERE id = $2 AND role = 'ADMIN' AND admin_status = 'PENDING' AND id <> $1 RETURNING id, name, email, phone, address, role, admin_status, is_primary_admin, approved_at",
      [req.user.id, req.params.id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending admin not found' });
    }
    await client.query('COMMIT');
    res.json({ ...result.rows[0], message: 'Admin approved successfully.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Approve admin error:', error);
    res.status(500).json({ error: 'Admin account could not be approved' });
  } finally {
    client.release();
  }
});

router.put('/admins/:id/reject', verifyToken, requireRole('ADMIN'), requirePrimaryAdmin, async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const request = await client.query(
      "UPDATE admin_approval_requests SET status = 'REJECTED', decided_by = $1, decided_at = CURRENT_TIMESTAMP WHERE admin_user_id = $2 AND status = 'PENDING' RETURNING id",
      [req.user.id, req.params.id]
    );
    if (!request.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending admin approval request not found' });
    }
    const result = await client.query(
      "UPDATE users SET is_verified = FALSE, admin_status = 'REJECTED', rejected_by = $1, rejected_at = CURRENT_TIMESTAMP WHERE id = $2 AND role = 'ADMIN' AND admin_status = 'PENDING' AND id <> $1 RETURNING id, name, email, phone, address, role, admin_status, is_primary_admin, rejected_at",
      [req.user.id, req.params.id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending admin not found' });
    }
    await client.query('COMMIT');
    res.json({ ...result.rows[0], message: 'Admin request rejected.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Reject admin error:', error);
    res.status(500).json({ error: 'Admin account could not be rejected' });
  } finally {
    client.release();
  }
});

router.get('/reports', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const reportType = req.query.type === 'monthly' ? 'monthly' : 'weekly';
    const dateValue = typeof req.query.date === 'string' ? req.query.date : formatDateOnly(new Date());
    const status = typeof req.query.status === 'string' && canonicalStatuses.includes(req.query.status) ? req.query.status : null;
    const range = getReportRange(reportType, dateValue);
    const values = [range.start, range.end];
    const filters = ['c.created_at >= $1::date', 'c.created_at < $2::date'];
    if (status) {
      values.push(status);
      filters.push(`c.status = $${values.length}`);
    }

    const summaryQuery = `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE c.status = 'REPORTED')::int AS reported,
      COUNT(*) FILTER (WHERE c.status = 'ASSIGNED')::int AS assigned,
      COUNT(*) FILTER (WHERE c.status = 'IN_PROGRESS')::int AS in_progress,
      COUNT(*) FILTER (WHERE c.status = 'CLEANED')::int AS cleaned,
      COUNT(*) FILTER (WHERE c.status = 'VERIFIED')::int AS verified,
      COUNT(*) FILTER (WHERE c.status = 'CLOSED')::int AS closed
      FROM complaints c ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}`;

    const summaryResult = await query(summaryQuery, values);
    const complaintsResult = await query(
      `SELECT c.id, c.complaint_id, c.status, c.waste_type, c.waste_intensity, c.description, c.address,
        c.created_at AS complaint_date, c.cleaned_at, c.verified_at, u.name AS user_name,
        coll.name AS collector_name, f.rating, f.comment AS feedback
       FROM complaints c
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN users coll ON coll.id = c.collector_id
       LEFT JOIN feedback f ON f.complaint_id = c.id
       ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
       ORDER BY c.created_at DESC`,
      values
    );

    res.json({
      report_period: range.label,
      summary: summaryResult.rows[0] || {
        total: 0,
        reported: 0,
        assigned: 0,
        in_progress: 0,
        cleaned: 0,
        verified: 0,
        closed: 0,
      },
      complaints: complaintsResult.rows,
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
