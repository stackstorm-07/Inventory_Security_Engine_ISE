const https = require('https');
const fs = require('fs');
const app = require('./app');
const pool = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT || 5443;

async function startServer() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Database connected');
    conn.release();

    //HTTP server
    app.listen(PORT, () => {
      console.log(`🔐 Security Engine running on http://localhost:${PORT}`);
    });

    //HTTPS server
    const httpsOptions = {
      key: fs.readFileSync('./certs/key.pem'),
      cert: fs.readFileSync('./certs/cert.pem')
    };

    https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
      console.log(`🔐 HTTPS Engine running on https://localhost:${HTTPS_PORT}`);
    });
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  }
}

startServer();
