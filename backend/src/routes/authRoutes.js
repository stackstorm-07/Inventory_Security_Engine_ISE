<<<<<<< HEAD
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');

const router = express.Router();

// 1. SIGNUP API (Hash password and store user)
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
    const query = `SELECT * FROM users WHERE email = ? OR username = ?`;
    const users = await conn.query(query, [usernameOrEmail, usernameOrEmail]);
    conn.release();

    if (users.length === 0) {
      return res.status(401).json({ error: "User not found." });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    // Success! (We will add JWT token generation here later)
    res.status(200).json({ message: "Login successful!" });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
});

=======
const express = require('express');
const bcrypt = require('bcrypt');
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
    const query = `INSERT INTO users (full_name, username, email, phone, password_hash, role, department, status, last_login) VALUES (?, ?, ?, ?, ?, 'user', 'General', 'active', NULL)`;
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
    const query = `SELECT id, username, email, role, department, status FROM users WHERE email = ? OR username = ?`;
    const users = await conn.query(query, [usernameOrEmail, usernameOrEmail]);
    conn.release();

    if (users.length === 0) {
      return res.status(401).json({ error: "User not found." });
    }

    const user = users[0];
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({ error: "Account is inactive." });
    }

    const passwordQuery = `SELECT password_hash FROM users WHERE id = ?`;
    const conn2 = await pool.getConnection();
    const passwordResult = await conn2.query(passwordQuery, [user.id]);
    conn2.release();

    if (passwordResult.length === 0) {
      return res.status(401).json({ error: "User not found." });
    }

    const isMatch = await bcrypt.compare(password, passwordResult[0].password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    // Update last login
    const updateQuery = `UPDATE users SET last_login = NOW() WHERE id = ?`;
    const conn3 = await pool.getConnection();
    await conn3.query(updateQuery, [user.id]);
    conn3.release();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        role: user.role,
        department: user.department
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
        department: user.department
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
});

>>>>>>> 4aa059ebd600e36e765937bbbfb4c90babcdb2ee
module.exports = router;