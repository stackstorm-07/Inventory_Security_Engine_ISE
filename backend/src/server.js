require('dotenv').config({ path: __dirname + '/../.env' }); // MUST BE FIRST

const https = require('https');
const fs = require('fs');
const app = require('./app');
const pool = require('./config/db');
const initializeDatabase = require('./initDb');

const PORT = process.env.PORT || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT || 5443;

async function startServer() {
  try {
    const conn = await pool.getConnection();
    console.log('Database connected');
    conn.release();

    // Initialize database tables and sample data
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`HTTP running on http://localhost:${PORT}`);
    });

    // OPTIONAL: comment HTTPS if certs not present
    /*
    const httpsOptions = {
      key: fs.readFileSync('./certs/key.pem'),
      cert: fs.readFileSync('./certs/cert.pem')
    };

    https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
      console.log(`HTTPS running on https://localhost:${HTTPS_PORT}`);
    });
    */

  } catch (err) {
    console.error('Database connection failed:', err);
  }
}

startServer();