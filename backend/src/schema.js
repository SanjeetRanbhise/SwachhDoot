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
        address TEXT,
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
    // Check if demo users already exist
    const users = await query('SELECT COUNT(*) FROM users');
    if (users.rows[0].count > 0) return;

    // Seed users
    await query(`
      INSERT INTO users (name, email, password_hash, phone, role, address) VALUES
      ('Demo Citizen', 'citizen@swachhdoot.demo', '$2a$10$demo.hash.citizen', '9876543210', 'USER', 'Mumbai, India'),
      ('Demo Collector', 'collector@swachhdoot.demo', '$2a$10$demo.hash.collector', '9876543211', 'COLLECTOR', 'Mumbai, India'),
      ('Demo Admin', 'admin@swachhdoot.demo', '$2a$10$demo.hash.admin', '9876543212', 'ADMIN', 'Mumbai, India')
    `);

    console.log('Database seeded with demo users');
  } catch (error) {
    console.error('Database seeding error:', error);
  }
}
