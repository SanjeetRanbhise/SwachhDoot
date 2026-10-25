import { query } from './db.js';

export async function initializeDatabase() {
  try {
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(50) CHECK(role IN ('USER', 'COLLECTOR', 'ADMIN')) NOT NULL,
        is_verified BOOLEAN NOT NULL DEFAULT TRUE,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT TRUE');
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_status VARCHAR(20)");
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_primary_admin BOOLEAN NOT NULL DEFAULT FALSE');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id)');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id)');
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP');
    await query('CREATE UNIQUE INDEX IF NOT EXISTS users_single_primary_admin_idx ON users (is_primary_admin) WHERE is_primary_admin = TRUE');
    await query("UPDATE users SET admin_status = CASE WHEN role = 'ADMIN' AND is_verified THEN 'APPROVED' WHEN role = 'ADMIN' THEN 'PENDING' ELSE NULL END WHERE admin_status IS NULL");
    await query("UPDATE users SET approved_at = COALESCE(approved_at, created_at) WHERE role = 'ADMIN' AND admin_status = 'APPROVED'");
    await query("UPDATE users SET is_primary_admin = TRUE WHERE id = (SELECT id FROM users WHERE role = 'ADMIN' AND admin_status = 'APPROVED' ORDER BY created_at, id LIMIT 1) AND NOT EXISTS (SELECT 1 FROM users WHERE is_primary_admin = TRUE)");

    await query(`
      CREATE TABLE IF NOT EXISTS admin_approval_requests (
        id SERIAL PRIMARY KEY,
        admin_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
        requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        decided_by INTEGER REFERENCES users(id),
        decided_at TIMESTAMP,
        CHECK (
          (status = 'PENDING' AND decided_by IS NULL AND decided_at IS NULL)
          OR (status IN ('APPROVED', 'REJECTED') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
        )
      );
    `);
    await query(`
      INSERT INTO admin_approval_requests (admin_user_id, status, requested_at)
      SELECT id, 'PENDING', COALESCE(created_at, CURRENT_TIMESTAMP)
      FROM users
      WHERE role = 'ADMIN' AND admin_status = 'PENDING'
      ON CONFLICT (admin_user_id) DO NOTHING
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS wmt_teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        member_count INTEGER NOT NULL CHECK(member_count BETWEEN 1 AND 6),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES wmt_teams(id)');
    await query(`
      CREATE TABLE IF NOT EXISTS wmt_team_members (
        id SERIAL PRIMARY KEY,
        team_id INTEGER NOT NULL REFERENCES wmt_teams(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20) NOT NULL,
        address TEXT NOT NULL
      );
    `);
    await query('ALTER TABLE wmt_team_members ADD COLUMN IF NOT EXISTS email VARCHAR(255)');
    await query('CREATE UNIQUE INDEX IF NOT EXISTS wmt_team_members_team_email_idx ON wmt_team_members (team_id, LOWER(email)) WHERE email IS NOT NULL');
    await query('CREATE UNIQUE INDEX IF NOT EXISTS wmt_team_members_team_phone_idx ON wmt_team_members (team_id, phone)');

    await query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create complaints table
    await query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        complaint_id VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id),
        collector_id INTEGER REFERENCES users(id),
        description TEXT NOT NULL,
        waste_type VARCHAR(100),
        image_url TEXT,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        address TEXT,
        status VARCHAR(50) CHECK(status IN ('REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'VERIFIED', 'CLOSED')) DEFAULT 'REPORTED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS cleaning_image_url TEXT');
    await query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id)');
    await query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS cleaned_at TIMESTAMP');
    await query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP');
    await query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS expected_cleaning_hours INTEGER NOT NULL DEFAULT 24');
    await query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS expected_cleaning_at TIMESTAMP');
    await query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS delay_reason TEXT');
    await query(`
        ALTER TABLE complaints
        ADD COLUMN IF NOT EXISTS waste_intensity VARCHAR(20)
        NOT NULL DEFAULT 'MEDIUM'
      `);
    await query(`
  UPDATE complaints
  SET expected_cleaning_at = created_at
    + (expected_cleaning_hours * INTERVAL '1 hour')
  WHERE expected_cleaning_at IS NULL
    AND created_at IS NOT NULL
    AND status <> 'REPORTED'
`);
    await query(`
      CREATE TABLE IF NOT EXISTS complaint_status_history (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL,
        performed_by INTEGER REFERENCES users(id),
        performed_role VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create feedback table
    await query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER REFERENCES complaints(id),
        user_id INTEGER REFERENCES users(id),
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query(`
  ALTER TABLE feedback
    ADD COLUMN IF NOT EXISTS waste_removed BOOLEAN,
    ADD COLUMN IF NOT EXISTS area_left_clean BOOLEAN,
    ADD COLUMN IF NOT EXISTS resolved_on_time BOOLEAN,
    ADD COLUMN IF NOT EXISTS overall_feedback VARCHAR(10)
`);

    // Create notifications table
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        collector_id INTEGER REFERENCES users(id),
        complaint_id INTEGER REFERENCES complaints(id),
        message TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

export async function seedDatabase() {
  try {
    await query(`DELETE FROM users u
      WHERE u.email IN ('citizen@swachhdoot.demo', 'collector@swachhdoot.demo', 'admin@swachhdoot.demo')
      AND NOT EXISTS (
        SELECT 1 FROM complaints c
        WHERE c.user_id = u.id OR c.collector_id = u.id OR c.assigned_by = u.id
      )`);
    console.log('Demo account seeding skipped');
  } catch (error) {
    console.error('Database seeding error:', error);
  }
}
