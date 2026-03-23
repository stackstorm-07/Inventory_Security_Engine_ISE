const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// ⚠️ TEMP: comment this if routes not created yet
// const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ✅ Test route (VERY IMPORTANT)
app.get('/', (req, res) => {
  res.send('API is running...');
});

// ⚠️ Enable later when authRoutes exists
// app.use('/api/auth', authRoutes);

module.exports = app;
