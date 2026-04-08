const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const nodemailer = require('nodemailer'); // ✅ IMPORTED NODEMAILER

const router = express.Router();

// --- EMAIL TRANSPORTER SETUP ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'inventorysecurityengine@gmail.com', // Your actual Gmail
    pass: 'qbdlupbfjhzlvefn' // Your actual App Password
  }
});

// Store CAPTCHA answers temporarily (in production, use Redis or database)
const captchaStore = new Map();

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

// 3. FORGOT PASSWORD - create reset token & SEND EMAIL
router.post('/forgot-password', async (req, res) => {
  const { identifier } = req.body; 

  if (!identifier) {
    return res.status(400).json({ error: 'Username or email is required.' });
  }

  try {
    const conn = await pool.getConnection();
    
    // Check database for EITHER username OR email
    const users = await conn.query('SELECT id, username, email FROM users WHERE username = ? OR email = ?', [identifier, identifier]);
    const user = users[0];
    
    // 🚨 Return an explicit 404 error if user does not exist
    if (!user) {
      conn.release();
      return res.status(404).json({ error: 'Username or email does not exist.' });
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

    // Send the actual email via Nodemailer
    const mailOptions = {
      from: 'inventorysecurityengine@gmail.com', 
      to: user.email, 
      subject: 'Your Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <div style="max-width: 500px; margin: auto; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <h2 style="color: #6a1b9a; text-align: center;">Password Reset Request</h2>
                <p>Hello <strong>${user.username}</strong>,</p>
                <p>You requested to reset your password. Your authorization code is:</p>
                <h1 style="color: #1e293b; background: #fff; padding: 15px; text-align: center; border-radius: 5px; border: 1px dashed #cbd5e1; letter-spacing: 3px;">${resetCode}</h1>
                <p>This code will expire in 15 minutes.</p>
                <p style="font-size: 12px; color: #64748b; margin-top: 20px;">If you did not request a password reset, please ignore this email securely.</p>
            </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    // 🚨 Definitive success message sent back
    res.status(200).json({ message: 'Please check your email inbox for your password reset code.' });
    
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// 4. RESET PASSWORD (Matches token against Username OR Email)
router.post('/reset-password', async (req, res) => {
  const { identifier, token, newPassword } = req.body;

  if (!identifier || !token || !newPassword) {
    return res.status(400).json({ error: 'Username/Email, reset code, and new password are required.' });
  }

  try {
    const conn = await pool.getConnection();
    const query = `
      SELECT pr.id AS token_id, pr.user_id
      FROM password_reset_tokens pr
      JOIN users u ON u.id = pr.user_id
      WHERE pr.token = ? AND (u.username = ? OR u.email = ?) AND pr.expires_at >= NOW()
      LIMIT 1
    `;
    const results = await conn.query(query, [token, identifier, identifier]);

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