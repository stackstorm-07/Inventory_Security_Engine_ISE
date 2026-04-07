const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const router = express.Router();

// 1. SIGNUP API (Hash password and store user)
router.post('/signup', async (req, res) => {
  const { fullName, username, email, phone, password } = req.body;

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const conn = await pool.getConnection();
    const query = `INSERT INTO users (full_name, username, email, phone, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, 'viewer', 1)`;
    await conn.query(query, [fullName, username, email, phone, hashedPassword]);
    conn.release();

    res.status(201).json({ message: "User securely registered!" });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: "Username or email already exists." });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to create account." });
  }
});

// 2. LOGIN API (Check password)
router.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  try {
    const conn = await pool.getConnection();
    const query = `SELECT id, username, email, role, is_active, password_hash FROM users WHERE email = ? OR username = ?`;
    const users = await conn.query(query, [usernameOrEmail, usernameOrEmail]);
    conn.release();

    if (users.length === 0) {
      return res.status(401).json({ error: "User not found." });
    }

    const user = users[0];
    
    // Check if user is active
    if (user.is_active !== 1) {
      return res.status(401).json({ error: "Account is inactive." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.status(200).json({ 
      message: "Login successful!", 
      token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
});

// 3. FORGOT PASSWORD - create reset token
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const conn = await pool.getConnection();

    const [user] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (!user) {
      conn.release();
      return res.status(404).json({ error: 'Email not found.' });
    }

    await conn.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (token),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    const resetCode = crypto.randomBytes(3).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await conn.query('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, resetCode, expiresAt]);
    conn.release();

    res.status(200).json({ message: 'Password reset code created successfully.', resetCode });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// 4. RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;

  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'Email, reset code, and new password are required.' });
  }

  try {
    const conn = await pool.getConnection();
    const query = `
      SELECT pr.id AS token_id, pr.user_id
      FROM password_reset_tokens pr
      JOIN users u ON u.id = pr.user_id
      WHERE pr.token = ? AND u.email = ? AND pr.expires_at >= NOW()
      LIMIT 1
    `;
    const results = await conn.query(query, [token, email]);

    if (results.length === 0) {
      conn.release();
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    const resetRecord = results[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, resetRecord.user_id]);
    await conn.query('DELETE FROM password_reset_tokens WHERE id = ?', [resetRecord.token_id]);
    conn.release();

    res.status(200).json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Unable to reset password.' });
  }
});

module.exports = router;