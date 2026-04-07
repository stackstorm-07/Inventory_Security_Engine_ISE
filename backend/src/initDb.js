const mariadb = require('mariadb');
require('dotenv').config();

async function initializeDatabase() {
  let conn;

  try {
    // Connect without specifying database first
    conn = await mariadb.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    });

    // Create database if it doesn't exist
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
    await conn.query(`USE ${process.env.DB_NAME}`);

    console.log('Database initialized successfully');

    // Create users table with additional columns
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager', 'user') DEFAULT 'user',
        department VARCHAR(100) DEFAULT 'General',
        status ENUM('active', 'inactive') DEFAULT 'active',
        last_login DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create inventory_logs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date_time DATETIME NOT NULL,
        asset_id VARCHAR(50) NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        user VARCHAR(255) NOT NULL,
        action ENUM('Checked Out', 'Checked In', 'Maintenance', 'Added', 'Removed') NOT NULL,
        location VARCHAR(255),
        status ENUM('Pending Return', 'Completed', 'In Progress', 'Cancelled') DEFAULT 'Completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create security_alerts table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS security_alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        details TEXT,
        time DATETIME NOT NULL,
        asset_id VARCHAR(50),
        severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create assets table for inventory management
    await conn.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        asset_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        location VARCHAR(255),
        status ENUM('available', 'checked_out', 'maintenance', 'retired') DEFAULT 'available',
        assigned_to VARCHAR(255),
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Tables created successfully');

    // Insert sample data
    await insertSampleData(conn);

  } catch (error) {
    console.error('Database initialization error:', error);
  } finally {
    if (conn) conn.end();
  }
}

async function insertSampleData(conn) {
  try {
    // Insert sample users
    await conn.query(`
      INSERT IGNORE INTO users (full_name, username, email, phone, password_hash, role, department, status) VALUES
      ('John Doe', 'johndoe', 'john.doe@company.com', '1234567890', '$2b$10$dummy.hash.for.demo', 'admin', 'IT Department', 'active'),
      ('Jane Smith', 'janesmith', 'jane.smith@company.com', '1234567891', '$2b$10$dummy.hash.for.demo', 'manager', 'Warehouse', 'active'),
      ('Mike Johnson', 'mikejohnson', 'mike.johnson@company.com', '1234567892', '$2b$10$dummy.hash.for.demo', 'user', 'Operations', 'active'),
      ('Sarah Wilson', 'sarahwilson', 'sarah.wilson@company.com', '1234567893', '$2b$10$dummy.hash.for.demo', 'user', 'Executive', 'active'),
      ('Tom Brown', 'tombrown', 'tom.brown@company.com', '1234567894', '$2b$10$dummy.hash.for.demo', 'user', 'IT Department', 'inactive')
    `);

    // Insert sample inventory logs
    await conn.query(`
      INSERT IGNORE INTO inventory_logs (date_time, asset_id, item_name, user, action, location, status) VALUES
      ('2026-04-06 14:30:00', 'AST-001', 'Dell Laptop XPS 13', 'John Doe', 'Checked Out', 'IT Department', 'Pending Return'),
      ('2026-04-06 11:15:00', 'AST-045', 'Samsung Monitor 27"', 'Jane Smith', 'Checked In', 'Warehouse A', 'Completed'),
      ('2026-04-05 16:45:00', 'AST-023', 'HP Printer LaserJet', 'Mike Johnson', 'Maintenance', 'Service Center', 'In Progress'),
      ('2026-04-05 09:20:00', 'AST-067', 'Apple iPad Pro', 'Sarah Wilson', 'Checked Out', 'Executive Office', 'Pending Return'),
      ('2026-04-04 13:10:00', 'AST-089', 'Lenovo ThinkPad', 'Tom Brown', 'Checked In', 'Warehouse B', 'Completed')
    `);

    // Insert sample security alerts
    await conn.query(`
      INSERT IGNORE INTO security_alerts (title, details, time, asset_id, severity, resolved) VALUES
      ('Unauthorized Access Attempt Detected', 'Multiple failed login attempts from IP 192.168.1.100 on Server Rack A', '2026-04-06 14:25:00', 'SRV-001', 'critical', FALSE),
      ('Inventory Discrepancy Alert', 'Item count mismatch in Warehouse B - 5 items unaccounted for', '2026-04-06 11:30:00', NULL, 'high', FALSE),
      ('Overdue Equipment Return', 'Dell Laptop XPS 13 (AST-001) overdue by 3 days - Assigned to John Doe', '2026-04-05 16:00:00', 'AST-001', 'medium', FALSE),
      ('Maintenance Reminder', 'Scheduled maintenance due for HP Printer LaserJet (AST-023)', '2026-04-04 09:00:00', 'AST-023', 'low', FALSE),
      ('New User Access Request', 'Pending approval for user registration: new.employee@company.com', '2026-04-03 14:15:00', NULL, 'low', FALSE)
    `);

    // Insert sample assets
    await conn.query(`
      INSERT IGNORE INTO assets (asset_id, name, category, location, status, assigned_to) VALUES
      ('AST-001', 'Dell Laptop XPS 13', 'Laptop', 'IT Department', 'checked_out', 'John Doe'),
      ('AST-045', 'Samsung Monitor 27"', 'Monitor', 'Warehouse A', 'available', NULL),
      ('AST-023', 'HP Printer LaserJet', 'Printer', 'Service Center', 'maintenance', NULL),
      ('AST-067', 'Apple iPad Pro', 'Tablet', 'Executive Office', 'checked_out', 'Sarah Wilson'),
      ('AST-089', 'Lenovo ThinkPad', 'Laptop', 'Warehouse B', 'available', NULL)
    `);

    console.log('Sample data inserted successfully');

  } catch (error) {
    console.error('Error inserting sample data:', error);
  }
}

module.exports = initializeDatabase;

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}