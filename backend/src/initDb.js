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

    // Create users table with additional columns
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'staff', 'viewer') DEFAULT 'viewer',
        totp_secret VARCHAR(255),
        is_2fa_enabled BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_alert (title, time, asset_id, severity)
      )
    `);

    try {
      await conn.query('ALTER TABLE security_alerts ADD UNIQUE KEY unique_alert (title, time, asset_id, severity)');
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME' && err.code !== 'ER_DUP_ENTRY') {
        throw err;
      }
    }

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

    await conn.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create complaints table for user feedback system
    await conn.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        category ENUM('system_error', 'data_issue', 'access_problem', 'performance', 'feature_request', 'other') NOT NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL,
        description TEXT NOT NULL,
        status ENUM('pending', 'in_progress', 'resolved', 'closed') DEFAULT 'pending',
        assigned_staff_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS viewer_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        viewer_user_id INT NOT NULL,
        asset_id VARCHAR(50) NOT NULL,
        note TEXT,
        status ENUM('pending', 'approved', 'rejected', 'fulfilled', 'cancelled') DEFAULT 'pending',
        staff_response TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (viewer_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS viewer_trades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_user_id INT NOT NULL,
        to_user_id INT NOT NULL,
        offer_asset_id VARCHAR(50) NOT NULL,
        request_asset_id VARCHAR(50) NOT NULL,
        message TEXT,
        status ENUM('pending', 'rejected', 'cancelled', 'completed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS two_factor_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        code VARCHAR(10) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

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
    const bcrypt = require('bcrypt');

    // Remove old default admin
    await conn.query(`DELETE FROM users WHERE username = 'admin'`);

    // Seed admin users
    const saltRounds = 10;
    const adminPassword = await bcrypt.hash('380011', saltRounds);
    const adminUsers = [
      { full_name: 'Administrator 1', username: 'AU2420148' },
      { full_name: 'Administrator 2', username: 'AU2420149' },
      { full_name: 'Administrator 3', username: 'AU2420150' }
    ];

    const adminValues = adminUsers.map(user => [user.full_name, user.username, `${user.username}@company.com`, null, adminPassword, 'admin', 1]);
    const adminPlaceholders = adminValues.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    await conn.query(
      `INSERT IGNORE INTO users (full_name, username, email, phone, password_hash, role, is_active) VALUES ${adminPlaceholders}`,
      adminValues.flat()
    );

    // Seed staff users
    const staffPassword = await bcrypt.hash('380010', saltRounds);
    const staffUsers = [
      { full_name: 'Staff Member 1', username: 'AU0000001' },
      { full_name: 'Staff Member 2', username: 'AU0000002' },
      { full_name: 'Staff Member 3', username: 'AU0000003' },
      { full_name: 'Staff Member 4', username: 'AU0000004' },
      { full_name: 'Staff Member 5', username: 'AU0000005' },
      { full_name: 'Staff Member 6', username: 'AU0000006' },
      { full_name: 'Staff Member 7', username: 'AU0000007' },
      { full_name: 'Staff Member 8', username: 'AU0000008' },
      { full_name: 'Staff Member 9', username: 'AU0000009' },
      { full_name: 'Staff Member 10', username: 'AU0000010' },
      { full_name: 'Staff Member 11', username: 'AU0000011' },
      { full_name: 'Staff Member 12', username: 'AU0000012' }
    ];

    const staffValues = staffUsers.map(user => [user.full_name, user.username, `${user.username}@company.com`, null, staffPassword, 'staff', 1]);
    const rowPlaceholders = staffValues.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    await conn.query(
      `INSERT IGNORE INTO users (full_name, username, email, phone, password_hash, role, is_active) VALUES ${rowPlaceholders}`,
      staffValues.flat()
    );

    // Seed viewer users
    const viewerPassword = await bcrypt.hash('viewer123', saltRounds);
    const viewerUsers = [
      { full_name: 'Viewer User 1', username: 'VU2421001' },
      { full_name: 'Viewer User 2', username: 'VU2421002' },
      { full_name: 'Viewer User 3', username: 'VU2421003' },
      { full_name: 'Viewer User 4', username: 'VU2421004' },
      { full_name: 'Viewer User 5', username: 'VU2421005' }
    ];
    const viewerValues = viewerUsers.map(user => [user.full_name, user.username, `${user.username}@company.com`, null, viewerPassword, 'viewer', 1]);
    const viewerPlaceholders = viewerValues.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    await conn.query(
      `INSERT IGNORE INTO users (full_name, username, email, phone, password_hash, role, is_active) VALUES ${viewerPlaceholders}`,
      viewerValues.flat()
    );

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
      ('AST-089', 'Lenovo ThinkPad', 'Laptop', 'Warehouse B', 'available', NULL),
      ('AST-100', 'HP EliteBook 840', 'Laptop', 'Viewer Locker', 'available', 'VU2421001'),
      ('AST-101', 'Apple iPad Mini', 'Tablet', 'Viewer Desk', 'available', 'VU2421002'),
      ('AST-102', 'Logitech Keyboard', 'Peripheral', 'Viewer Workspace', 'available', 'VU2421003')
    `);

    // Seed sample viewer orders and trades
    await conn.query(`
      INSERT IGNORE INTO viewer_orders (viewer_user_id, asset_id, note, status, staff_response) VALUES
      ((SELECT id FROM users WHERE username = 'VU2421001'), 'AST-045', 'Requesting monitor for remote work.', 'pending', NULL),
      ((SELECT id FROM users WHERE username = 'VU2421002'), 'AST-089', 'Need laptop for weekend testing.', 'approved', 'Approved by staff for one-week loan.'),
      ((SELECT id FROM users WHERE username = 'VU2421003'), 'AST-067', 'Tablet required for delivery verification.', 'rejected', 'Asset currently assigned; try a later date.')
    `);

    await conn.query(`
      INSERT IGNORE INTO viewer_trades (from_user_id, to_user_id, offer_asset_id, request_asset_id, message, status) VALUES
      ((SELECT id FROM users WHERE username = 'VU2421001'), (SELECT id FROM users WHERE username = 'VU2421002'), 'AST-001', 'AST-067', 'Would you swap your iPad for my laptop?', 'pending'),
      ((SELECT id FROM users WHERE username = 'VU2421004'), (SELECT id FROM users WHERE username = 'VU2421003'), 'AST-089', 'AST-045', 'Requesting your monitor for a short period.', 'pending')
    `);

    await conn.query(`
      INSERT IGNORE INTO complaints (user_id, title, category, priority, description, status, assigned_staff_id) VALUES
      ((SELECT id FROM users WHERE username = 'VU2421005'), 'Unable to submit an order', 'access_problem', 'medium', 'The order page is not accepting details and the button keeps spinning.', 'pending', NULL),
      ((SELECT id FROM users WHERE username = 'VU2421002'), 'Asset assignment does not update', 'system_error', 'high', 'I submitted an order but my asset still shows as not assigned.', 'in_progress', (SELECT id FROM users WHERE username = 'AU0000001'))
    `);


    // Create contact_submissions table for homepage contact form
    await conn.query(`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(30),
        query TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

  } catch (error) {
    console.error('Error inserting sample data:', error);
  }
}

module.exports = initializeDatabase;

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}