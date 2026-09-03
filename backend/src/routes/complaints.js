import { query } from '../db.js';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Setup multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Verify token middleware
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

// Generate unique complaint ID
function generateComplaintId() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');
  return `SD-${year}-${random}`;
}

// Create complaint
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const user = jwt.verify(token, JWT_SECRET);
    const { description, waste_type, latitude, longitude, address } = req.body;

    if (!description || !waste_type) {
      return res.status(400).json({ error: 'Description and waste type required' });
    }

    const complaint_id = generateComplaintId();
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await query(
      `INSERT INTO complaints (complaint_id, user_id, description, waste_type, image_url, latitude, longitude, address, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'REPORTED')
       RETURNING *`,
      [complaint_id, user.id, description, waste_type, image_url, latitude || null, longitude || null, address || null]
    );

    res.json({ complaint: result.rows[0], complaint_id });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ error: 'Failed to create complaint' });
  }
});

// Get complaint by ID
router.get('/:complaintId', async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, u.name as reporter_name, coll.name as collector_name
       FROM complaints c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users coll ON c.collector_id = coll.id
       WHERE c.complaint_id = $1`,
      [req.params.complaintId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get complaint error:', error);
    res.status(500).json({ error: 'Failed to fetch complaint' });
  }
});

// Get user's complaints
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const user = jwt.verify(token, JWT_SECRET);
    const result = await query('SELECT * FROM complaints WHERE user_id = $1 ORDER BY created_at DESC', [user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Update complaint status
router.put('/:id/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const user = jwt.verify(token, JWT_SECRET);
    const { status } = req.body;
    const complaintId = req.params.id;

    if (!status) {
      return res.status(400).json({ error: 'Status required' });
    }

    if (user.role !== 'COLLECTOR' && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = await query('UPDATE complaints SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [
      status,
      complaintId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Accept complaint (assign collector)
router.put('/:id/accept', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const user = jwt.verify(token, JWT_SECRET);

    if (user.role !== 'COLLECTOR') {
      return res.status(403).json({ error: 'Only collectors can accept complaints' });
    }

    const complaintId = req.params.id;
    const result = await query(
      'UPDATE complaints SET collector_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [user.id, 'ASSIGNED', complaintId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Accept complaint error:', error);
    res.status(500).json({ error: 'Failed to accept complaint' });
  }
});

export default router;
