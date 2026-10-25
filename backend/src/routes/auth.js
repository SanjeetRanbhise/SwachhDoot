import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getClient, query } from '../db.js';
import { isDescriptiveTextTooLong } from '../validation.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured');
const VALID_ROLES = ['USER', 'COLLECTOR', 'ADMIN'];
const RESET_TOKEN_TTL_MINUTES = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const isValidPhone = (phone) => /^\d{10}$/.test(phone || '');

export function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
    if (req.user.role === 'ADMIN') {
      const result = await query('SELECT admin_status FROM users WHERE id = $1 AND role = $2', [req.user.id, 'ADMIN']);
      const status = result.rows[0]?.admin_status;
      if (status === 'PENDING') return res.status(403).json({ error: 'Your Admin account is pending approval from the Primary Admin.' });
      if (status === 'REJECTED') return res.status(403).json({ error: 'Your Admin registration has been rejected.' });
      if (status !== 'APPROVED') return res.status(403).json({ error: 'Admin account approval is required.' });
    }
    next();
  };
}

export function requirePrimaryAdmin(req, res, next) {
  query('SELECT is_primary_admin FROM users WHERE id = $1 AND role = $2 AND admin_status = $3', [req.user.id, 'ADMIN', 'APPROVED'])
    .then((result) => {
      if (!result.rows[0]?.is_primary_admin) return res.status(403).json({ error: 'Only the Primary Admin can manage Admin accounts.' });
      next();
    })
    .catch((error) => {
      console.error('Primary admin authorization error:', error);
      res.status(500).json({ error: 'Unable to verify admin permissions' });
    });
}

export function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, address, role, teamName, teamAddress, members } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!name?.trim() || !normalizedEmail || !password || !confirmPassword || !phone?.trim() || !address?.trim() || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (isDescriptiveTextTooLong(address)) {
      return res.status(400).json({ error: 'Address must be 160 characters or fewer' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (!isValidPhone(phone.trim())) {
      return res.status(400).json({ error: 'Phone number must contain exactly 10 digits' });
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid account type' });
    }

    if (role === 'COLLECTOR') {
      if (!teamName?.trim() || !teamAddress?.trim() || !Array.isArray(members) || members.length < 1 || members.length > 6) {
        return res.status(400).json({ error: 'Team name, team address, and 1 to 6 members are required' });
      }
      if (isDescriptiveTextTooLong(teamAddress) || members.some((member) => isDescriptiveTextTooLong(member?.address))) {
        return res.status(400).json({ error: 'Team and member addresses must be 160 characters or fewer' });
      }
      if (members.some((member) => !member.name?.trim() || !member.address?.trim() || !member.email?.trim() || !isValidPhone(member.phone?.trim()))) {
        return res.status(400).json({ error: 'Every team member needs a name, valid email, address, and exactly 10-digit phone number' });
      }
      const memberEmails = members.map((member) => member.email.trim().toLowerCase());
      const memberPhones = members.map((member) => member.phone.trim());
      if (memberEmails.some((memberEmail) => !EMAIL_PATTERN.test(memberEmail))) {
        return res.status(400).json({ error: 'Every team member must have a valid email address' });
      }
      if (new Set(memberEmails).size !== memberEmails.length) {
        return res.status(409).json({ error: 'Team member email addresses must be different' });
      }
      if (new Set(memberPhones).size !== memberPhones.length) {
        return res.status(409).json({ error: 'Team member phone numbers must be different' });
      }
      if (memberEmails.includes(normalizedEmail)) {
        return res.status(409).json({ error: 'Team leader email must be different from member emails' });
      }
      if (memberPhones.includes(phone.trim())) {
        return res.status(409).json({ error: 'Team leader phone must be different from member phones' });
      }
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check for duplicate email
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists. Please use another email or login.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    let teamId = null;
    if (role === 'COLLECTOR') {
      const team = await query('INSERT INTO wmt_teams (name, address, member_count) VALUES ($1, $2, $3) RETURNING id', [teamName.trim(), teamAddress.trim(), members.length]);
      teamId = team.rows[0].id;
      for (const member of members) {
        await query('INSERT INTO wmt_team_members (team_id, name, email, phone, address) VALUES ($1, $2, $3, $4, $5)', [teamId, member.name.trim(), member.email.trim().toLowerCase(), member.phone.trim(), member.address.trim()]);
      }
    }
    const insertUser = 'INSERT INTO users (name, email, password_hash, phone, address, role, is_verified, admin_status, is_primary_admin, approved_at, team_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $9 THEN CURRENT_TIMESTAMP ELSE NULL END, $10) RETURNING id, email, name, phone, address, role, is_verified, admin_status, is_primary_admin';
    let result;

    if (role === 'ADMIN') {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        result = await client.query(insertUser, [name.trim(), normalizedEmail, password_hash, phone.trim(), address.trim(), role, false, 'PENDING', false, teamId]);
        await client.query('INSERT INTO admin_approval_requests (admin_user_id) VALUES ($1)', [result.rows[0].id]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    } else {
      result = await query(insertUser, [name.trim(), normalizedEmail, password_hash, phone.trim(), address.trim(), role, true, null, false, teamId]);
    }

    if (role === 'ADMIN') {
      return res.status(201).json({ message: 'Registration successful. Your Admin account is pending approval from the Primary Admin.' });
    }

    if (!verified) {
      return res.status(201).json({ message: 'Registration successful. Your Admin account is pending approval from the Primary Admin.' });
    }

    const token = jwt.sign(
      { id: result.rows[0].id, email: result.rows[0].email, role: result.rows[0].role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: result.rows[0] });
  } catch (error) {
    console.error('Register error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: error.constraint?.includes('team_email') ? 'A team member email is already used in this team' : error.constraint?.includes('team_phone') ? 'A team member phone number is already used in this team' : 'Email already exists. Please use another email or login.' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role === 'ADMIN' && user.admin_status === 'PENDING') {
      return res.status(403).json({ error: 'Your Admin account is pending approval from the Primary Admin.' });
    }
    if (user.role === 'ADMIN' && user.admin_status === 'REJECTED') {
      return res.status(403).json({ error: 'Your Admin registration has been rejected.' });
    }
    if (!user.is_verified) {
      return res.status(403).json({ error: 'This account is pending administrator approval' });
    }

    if (role && user.role !== role) {
      return res.status(401).json({ error: `This account is registered as ${user.role}` });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        admin_status: user.admin_status,
        is_primary_admin: user.is_primary_admin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const genericResponse = {
    message: 'If an account with that email exists, a password reset link has been generated.',
  };

  try {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' });

    const result = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (result.rows.length === 0) return res.json(genericResponse);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [result.rows[0].id]);
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [result.rows[0].id, tokenHash, expiresAt]
    );

    // A mail provider can consume the same token later. For the prototype, expose
    // the URL only outside production so it can be copied from the UI.
    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        ...genericResponse,
        resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}`,
      });
    }

    res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Unable to process password reset request' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Token, password, and confirmation are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const tokenHash = hashResetToken(token);
    const result = await query(
      'SELECT id, user_id FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP',
      [tokenHash]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, result.rows[0].user_id]);
    await query('DELETE FROM password_reset_tokens WHERE id = $1', [result.rows[0].id]);

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Unable to reset password' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const user = jwt.verify(token, JWT_SECRET);
    const result = await query('SELECT id, name, email, phone, address, role, admin_status, is_primary_admin FROM users WHERE id = $1', [user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (result.rows[0].role === 'ADMIN' && result.rows[0].admin_status !== 'APPROVED') {
      const message = result.rows[0].admin_status === 'REJECTED' ? 'Your Admin registration has been rejected.' : 'Your Admin account is pending approval from the Primary Admin.';
      return res.status(403).json({ error: message });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
});

export default router;
