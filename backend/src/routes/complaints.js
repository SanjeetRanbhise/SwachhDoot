import { getClient, query } from '../db.js';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { verifyToken, requireRole } from './auth.js';
import { isDescriptiveTextTooLong } from '../validation.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);
const uploadDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});

const statuses = ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'VERIFIED', 'CLOSED'];
const allowedNext = { REPORTED: ['ASSIGNED'], ASSIGNED: ['IN_PROGRESS'], IN_PROGRESS: ['CLEANED'], CLEANED: ['VERIFIED'], VERIFIED: ['CLOSED'], CLOSED: [] };
const generateComplaintId = () => `SD-${new Date().getFullYear()}-${crypto.randomInt(0, 100000).toString().padStart(5, '0')}`;

async function recordStatus(complaintId, status, user) {
  await query('INSERT INTO complaint_status_history (complaint_id, status, performed_by, performed_role) VALUES ($1, $2, $3, $4)', [complaintId, status, user.id, user.role]);
}

async function getComplaint(id) {
  const result = await query(
    `SELECT c.*, u.name AS reporter_name, u.phone AS reporter_phone, coll.name AS collector_name, admin.name AS assigned_by_name,
      COALESCE(json_agg(json_build_object('status', h.status, 'performed_by', h.performed_by, 'performed_role', h.performed_role, 'created_at', h.created_at) ORDER BY h.created_at) FILTER (WHERE h.id IS NOT NULL), '[]') AS status_history,
      f.rating, f.comment AS feedback, f.created_at AS feedback_created_at
     FROM complaints c LEFT JOIN users u ON c.user_id = u.id LEFT JOIN users coll ON c.collector_id = coll.id LEFT JOIN users admin ON c.assigned_by = admin.id
     LEFT JOIN complaint_status_history h ON h.complaint_id = c.id LEFT JOIN feedback f ON f.complaint_id = c.id WHERE c.id = $1
     GROUP BY c.id, u.name, u.phone, coll.name, admin.name, f.rating, f.comment, f.created_at`, [id]);
  return result.rows[0];
}

router.post('/', verifyToken, requireRole('USER'), upload.single('image'), async (req, res) => {
  try {
    const {
  description,
  waste_type,
  latitude,
  longitude,
  address,
  waste_intensity,
} = req.body;
    if (isDescriptiveTextTooLong(description) || isDescriptiveTextTooLong(address)) {
      if (req.file) {
        try {
          await fs.promises.unlink(req.file.path);
        } catch (error) {
          console.error('Failed to remove rejected complaint upload:', error);
        }
      }
      return res.status(400).json({ error: 'Description and address must be 160 characters or fewer' });
    }
    if (!req.file) return res.status(400).json({ error: 'A complaint photo is required' });
    if (!description?.trim() || description.trim().toLowerCase() === 'other') return res.status(400).json({ error: 'Please provide a meaningful description' });
    if (!waste_type?.trim() || !address?.trim()) return res.status(400).json({ error: 'Waste type and address are required' });
    const validIntensities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const wasteIntensity = String(waste_intensity || '').toUpperCase();

if (!validIntensities.includes(wasteIntensity)) {
  return res.status(400).json({ error: 'Please select a valid waste intensity' });
}
const complaintId = generateComplaintId();
const fileExt = path.extname(req.file.originalname).toLowerCase();
const storagePath = `complaints/${Date.now()}-${crypto.randomUUID()}${fileExt}`;

const { error: uploadError } = await supabase.storage
  .from('complaint-photos')
  .upload(storagePath, await fs.promises.readFile(req.file.path), {
    contentType: req.file.mimetype,
    upsert: false,
  });

if (uploadError) {
  console.error('Supabase photo upload failed:', uploadError);
  return res.status(500).json({ error: 'Failed to store complaint photo' });
}

const { data: publicUrlData } = supabase.storage
  .from('complaint-photos')
  .getPublicUrl(storagePath);

const imageUrl = publicUrlData.publicUrl;

// Remove the temporary local upload after Supabase stores it.
await fs.promises.unlink(req.file.path).catch(() => {});


const result = await query(
  `INSERT INTO complaints (
      complaint_id,
      user_id,
      description,
      waste_type,
      image_url,
      latitude,
      longitude,
      address,
      waste_intensity,
      status
   )
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'REPORTED')
   RETURNING *`,
  [
    complaintId,
    req.user.id,
    description.trim(),
    waste_type.trim(),
    imageUrl,
    latitude || null,
    longitude || null,
    address.trim(),
    wasteIntensity
  ]
);

    await recordStatus(result.rows[0].id, 'REPORTED', req.user);
    res.json({ complaint: result.rows[0], complaint_id: complaintId });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ error: 'Failed to create complaint' });
  }
});

router.get('/:complaintId', verifyToken, async (req, res) => {
  try {
    const lookup = await query('SELECT id FROM complaints WHERE complaint_id = $1', [req.params.complaintId]);
    if (!lookup.rows.length) return res.status(404).json({ error: 'Complaint not found' });
    const complaint = await getComplaint(lookup.rows[0].id);
    if (req.user.role === 'USER' && complaint.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (req.user.role === 'COLLECTOR' && complaint.collector_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    res.json(complaint);
  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({ error: 'Failed to fetch complaint' });
  }
});

router.get('/', verifyToken, requireRole('USER'), async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, f.rating, f.comment AS feedback
       FROM complaints c
       LEFT JOIN feedback f ON f.complaint_id = c.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

router.put('/:id/status', verifyToken, requireRole('COLLECTOR', 'ADMIN'), async (req, res) => {
  let client;
  try {
    const { status } = req.body;
    if (!statuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (status === 'CLEANED') return res.status(400).json({ error: 'Upload a cleaning photo to mark this complaint cleaned' });
    client = await getClient();
    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM complaints WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const complaint = current.rows[0];
    if (req.user.role === 'COLLECTOR' && complaint.collector_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Complaint is not assigned to your team' });
    }
    if (!allowedNext[complaint.status].includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot change ${complaint.status} to ${status}` });
    }
    const result = await client.query('UPDATE complaints SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [status, req.params.id]);
    await client.query('INSERT INTO complaint_status_history (complaint_id, status, performed_by, performed_role) VALUES ($1, $2, $3, $4)', [complaint.id, status, req.user.id, req.user.role]);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update complaint status error:', error);
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Database update failed' });
  } finally {
    client?.release();
  }
});

router.put('/:id/cleaning', verifyToken, requireRole('COLLECTOR'), upload.single('image'), async (req, res) => {
  let client;
  try {
    const delayReason = req.body?.delay_reason?.trim() || '';
    if (isDescriptiveTextTooLong(req.body?.delay_reason)) {
      if (req.file) {
        try {
          await fs.promises.unlink(req.file.path);
        } catch (error) {
          console.error('Failed to remove rejected cleaning upload:', error);
        }
      }
      return res.status(400).json({ error: 'Delay reason must be 160 characters or fewer' });
    }
    if (!req.file) return res.status(400).json({ error: 'Cleaning photo is required' });
    client = await getClient();
    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM complaints WHERE id = $1 AND collector_id = $2 FOR UPDATE', [req.params.id, req.user.id]);
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ error: 'Assigned complaint not found' });
    }
    if (current.rows[0].status !== 'IN_PROGRESS') {
      await client.query('ROLLBACK');
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Start cleaning before uploading a cleaning photo' });
    }
    const isOverdue = current.rows[0].expected_cleaning_at && new Date(current.rows[0].expected_cleaning_at).getTime() < Date.now();
    if (isOverdue && !delayReason) {
      await client.query('ROLLBACK');
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'This complaint has exceeded its time limit. Please provide a reason for the delay.' });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
const storagePath = `cleaning/${Date.now()}-${crypto.randomUUID()}${fileExt}`;

const { error: uploadError } = await supabase.storage
  .from('complaint-photos')
  .upload(
    storagePath,
    await fs.promises.readFile(req.file.path),
    {
      contentType: req.file.mimetype,
      upsert: false,
    }
  );

if (uploadError) {
  console.error('Supabase cleaning photo upload failed:', uploadError);
  throw uploadError;
}

const { data: cleaningPublicUrlData } = supabase.storage
  .from('complaint-photos')
  .getPublicUrl(storagePath);

const cleaningImageUrl = cleaningPublicUrlData.publicUrl;

    const result = await client.query(
      `UPDATE complaints SET cleaning_image_url = $1, status = 'CLEANED', cleaned_at = CURRENT_TIMESTAMP,
       delay_reason = CASE WHEN $3 <> '' THEN $3 ELSE delay_reason END, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [cleaningImageUrl, req.params.id, delayReason]);
    await client.query('INSERT INTO complaint_status_history (complaint_id, status, performed_by, performed_role) VALUES ($1, $2, $3, $4)', [Number(req.params.id), 'CLEANED', req.user.id, req.user.role]);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    console.error('Save cleaning update error:', error);
    res.status(500).json({ error: 'Failed to save cleaning update' });
  } finally {
    client?.release();
  }
});

router.put('/:id/accept', verifyToken, requireRole('COLLECTOR'), async (req, res) => {
  try {
    const result = await query(`UPDATE complaints SET collector_id = $1, status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND (collector_id IS NULL OR collector_id = $1) RETURNING *`, [req.user.id, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Complaint not found or already assigned' });
    await recordStatus(result.rows[0].id, 'ASSIGNED', req.user);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept complaint' });
  }
});

export default router;
