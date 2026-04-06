const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path'); 

// ✅ 1. UNCOMMENTED: Bring in your new authentication routes
const authRoutes = require('./routes/authRoutes');

const app = express();

// Security and utility middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Serve the frontend folder
app.use(express.static(path.join(__dirname, '../../frontend')));

// Test route to ensure API is running
app.get('/api-status', (req, res) => {
  res.send('API is running...');
});

// ✅ 2. UNCOMMENTED: Tell Express to use the auth routes for any /api/auth requests!
app.use('/api/auth', authRoutes);

module.exports = app;
