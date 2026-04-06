const mariadb = require('mariadb');
require('dotenv').config();

console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASS:", process.env.DB_PASSWORD);

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10
});

module.exports = pool;