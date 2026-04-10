const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const nodemailer = require('nodemailer');

const router = express.Router();

// --- EMAIL TRANSPORTER SETUP ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'inventorysecurityengine@gmail.com', // Your actual Gmail
    pass: 'qbdlupbfjhzlvefn' // Your actual App Password
  }
});

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

// 2. LOGIN API (Check password, Role-Based 2FA)
router.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  try {
    const conn = await pool.getConnection();
    const query = `SELECT id, username, email, role, is_active, password_hash FROM users WHERE email = ? OR username = ?`;
    const users = await conn.query(query, [usernameOrEmail, usernameOrEmail]);

    if (users.length === 0) {
      conn.release();
      return res.status(401).json({ error: "User not found." });
    }

    const user = users[0];
    
    if (user.is_active !== 1) {
      conn.release();
      return res.status(401).json({ error: "Account is inactive." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      conn.release();
      return res.status(401).json({ error: "Incorrect password." });
    }

    // 🚨 ROLE CHECK: Bypass 2FA if the user is 'admin' or 'staff'
    if (user.role === 'admin' || user.role === 'staff') {
      conn.release();
      
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
      );

      return res.status(200).json({ 
        message: "Admin/Staff Login successful!", 
        token: token,
        user: { id: user.id, username: user.username, role: user.role, email: user.email }
      });
    }

    // --- 2FA LOGIC FOR STANDARD USERS (Viewers, etc.) ---
    await conn.query(`CREATE TABLE IF NOT EXISTS two_factor_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      code VARCHAR(10) NOT NULL,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await conn.query('DELETE FROM two_factor_tokens WHERE user_id = ?', [user.id]);
    await conn.query('INSERT INTO two_factor_tokens (user_id, code, expires_at) VALUES (?, ?, ?)', [user.id, twoFactorCode, expiresAt]);
    conn.release();

    const mailOptions = {
      from: 'inventorysecurityengine@gmail.com', 
      to: user.email, 
      subject: 'Your Login Authentication Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <div style="max-width: 500px; margin: auto; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <h2 style="color: #6a1b9a; text-align: center;">Login Attempt Detected</h2>
                <p>Hello <strong>${user.username}</strong>,</p>
                <p>Your two-factor authentication code is:</p>
                <h1 style="color: #1e293b; background: #fff; padding: 15px; text-align: center; border-radius: 5px; border: 1px dashed #cbd5e1; letter-spacing: 5px;">${twoFactorCode}</h1>
                <p>This code will expire in 10 minutes.</p>
            </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ requires2FA: true, userId: user.id, message: "2FA code sent to your email." });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
});

// 2.5 VERIFY 2FA API (Step 2: Validate code and return JWT Token)
router.post('/verify-2fa', async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) return res.status(400).json({ error: 'User ID and code are required.' });

  try {
    const conn = await pool.getConnection();
    const query = `SELECT * FROM two_factor_tokens WHERE user_id = ? AND code = ? AND expires_at >= NOW()`;
    const results = await conn.query(query, [userId, code]);

    if (results.length === 0) {
      conn.release();
      return res.status(401).json({ error: 'Invalid or expired authentication code.' });
    }

    await conn.query('DELETE FROM two_factor_tokens WHERE user_id = ?', [userId]);
    const users = await conn.query('SELECT id, username, email, role FROM users WHERE id = ?', [userId]);
    conn.release();
    
    const user = users[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    res.status(200).json({ 
      message: "Login successful!", 
      token: token,
      user: { id: user.id, username: user.username, role: user.role, email: user.email }
    });

  } catch (error) {
    console.error("Verify 2FA Error:", error);
    res.status(500).json({ error: "Server error during verification." });
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
    const users = await conn.query('SELECT id, username, email FROM users WHERE username = ? OR email = ?', [identifier, identifier]);
    const user = users[0];
    
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


// 5. CONTACT FORM — saves to DB and sends emails
router.post("/contact", async (req, res) => {
  const { name, email, phone, query } = req.body;

  if (!name || !email || !query) {
    return res.status(400).json({ error: "Name, email, and query are required." });
  }

  try {
    const conn = await pool.getConnection();
    await conn.query(
      "INSERT INTO contact_submissions (name, email, phone, query) VALUES (?, ?, ?, ?)",
      [name, email, phone || null, query]
    );
    conn.release();

    const teamMail = {
      from: "inventorysecurityengine@gmail.com",
      to:   "inventorysecurityengine@gmail.com",
      subject: "[ISE Contact] New message from " + name,
      html: "<div style=\"font-family:sans-serif;padding:20px\"><h2>New Contact: " + name + "</h2><p><b>Email:</b> " + email + "</p><p><b>Phone:</b> " + (phone || "N/A") + "</p><p><b>Query:</b> " + query + "</p></div>"
    };

    const confirmMail = {
      from: "inventorysecurityengine@gmail.com",
      to:   email,
      subject: "We received your message — ISE Team",
      html: "<div style=\"font-family:sans-serif;padding:20px\"><h2>Hi " + name + ", we got your message!</h2><p>Thank you for contacting the Inventory Security Engine team. We will get back to you soon.</p><p><b>Your message:</b> " + query + "</p><p style=\"margin-top:20px;color:#64748b\">— Group 09, Ahmedabad University 2026</p></div>"
    };

    await transporter.sendMail(teamMail);
    await transporter.sendMail(confirmMail);

    res.status(200).json({ message: "Message received and confirmation sent." });
  } catch (error) {
    console.error("Contact Form Error:", error);
    res.status(500).json({ error: "Failed to process your message." });
  }
});

module.exports = router;