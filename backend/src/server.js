const app = require('./app');
const pool = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Database connected');
    conn.release();

    app.listen(PORT, () => {
      console.log(`🔐 Security Engine running on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('❌ Database connection failed:', err);
  }
}

startServer();
