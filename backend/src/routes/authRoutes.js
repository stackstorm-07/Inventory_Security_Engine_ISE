const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db'); // No JWT import anymore!

const router = express.Router();

// 1. SIGNUP API
router.post('/signup', async (req, res) => {
  const { fullName, username, email, phone, password } = req.body;

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const conn = await pool.getConnection();
    const query = `INSERT INTO users (full_name, username, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)`;
    await conn.query(query, [fullName, username, email, phone, hashedPassword]);
    conn.release();

    res.status(201).json({ message: "User securely registered!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create account." });
  }
});

// 2. LOGIN API (Simple Password Check)
router.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  try {
    const conn = await pool.getConnection();
    const query = `SELECT * FROM users WHERE email = ? OR username = ?`;
    const users = await conn.query(query, [usernameOrEmail, usernameOrEmail]);
    conn.release();

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid username or email." });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    // Completely removed JWT. Just sending a simple success message!
    res.status(200).json({ message: "Login successful!" });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
});

module.exports = router;