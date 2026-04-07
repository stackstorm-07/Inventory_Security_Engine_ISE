const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Auth routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Middleware imports
const { verifyToken } = require('./middleware/auth');
const { requireRole } = require('./middleware/rbac');

const app = express();

// Security and utility middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Serve the frontend folder
app.use(express.static(path.join(__dirname, '../../frontend')));

// Test route
app.get('/api-status', (req, res) => {
  res.send('API is running...');
});

// Auth routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Protected routes
app.get('/api/dashboard', verifyToken, requireRole('admin', 'manager', 'user'), (req, res) => {
  res.json({ message: `Welcome ${req.user.username}! Role: ${req.user.role}` });
});

app.get('/api/admin', verifyToken, requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin only area' });
});

app.get('/api/reports', verifyToken, requireRole('admin', 'manager'), (req, res) => {
  res.json({ message: 'Reports - admin and manager only' });
});

module.exports = app;