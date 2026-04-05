// backend/src/routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// 1. SIGNUP API (Hash password and store user)
router.post('/signup', [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('username').trim().isAlphanumeric().isLength({ min: 3, max: 50 }).withMessage('Username is required'),
  body('email').normalizeEmail().isEmail().withMessage('Valid email is required'),
  body('phone').isMobilePhone().withMessage('Invalid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { fullName, username, email, phone, password } = req.body;

  try {
    // Hash the password using bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Save to MariaDB
    const conn = await pool.getConnection();
    const query = `INSERT INTO users (full_name, username, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)`;
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
router.post('/login', [
  body('usernameOrEmail').trim().notEmpty().withMessage('Username or email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { usernameOrEmail, password } = req.body;

  try {
    const conn = await pool.getConnection();
    // Find user by email or username
    const query = `SELECT * FROM users WHERE email = ? OR username = ?`;
    const users = await conn.query(query, [usernameOrEmail, usernameOrEmail]);
    conn.release();

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const user = users[0];

    // Compare the typed password with the hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Success! (We will add JWT token generation here later)
    res.status(200).json({ message: "Login successful!" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error during login." });
  }
});

module.exports = router;