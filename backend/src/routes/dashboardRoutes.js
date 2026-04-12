const express = require('express');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

const reportMailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ISE_EMAIL,
    pass: process.env.ISE_EMAIL_PASSWORD
  }
});

// Current user profile (for client-side display / trade matching)
router.get('/me', verifyToken, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      'SELECT id, username, full_name, email, role FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  } finally {
    if (conn) conn.release();
  }
});

// Assets CRUD - dashboard inventory source
router.get('/assets', verifyToken, requireRole('admin', 'staff', 'viewer'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      SELECT asset_id, name, status, assigned_to, category, location, created_at, last_updated
      FROM assets
      ORDER BY last_updated DESC
    `;
    const assets = await conn.query(query);
    res.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/assets', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  const { asset_id, name, status, assigned_to, category, location } = req.body;

  if (!asset_id || !name || !status) {
    return res.status(400).json({ error: 'asset_id, name, and status are required.' });
  }

  const allowedStatuses = ['available', 'checked_out', 'maintenance', 'retired'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      INSERT INTO assets (asset_id, name, status, assigned_to, category, location)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await conn.query(query, [
      asset_id,
      name,
      status,
      assigned_to || null,
      category || null,
      location || null
    ]);

    res.status(201).json({ message: 'Asset created successfully.' });
  } catch (error) {
    console.error('Error creating asset:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Asset ID already exists.' });
    }
    res.status(500).json({ error: 'Failed to create asset.' });
  } finally {
    if (conn) conn.release();
  }
});

router.patch('/assets/:assetId', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  const { assetId } = req.params;
  const { status, assigned_to } = req.body;

  const updates = [];
  const params = [];

  if (status !== undefined) {
    const allowedStatuses = ['available', 'checked_out', 'maintenance', 'retired'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    updates.push('status = ?');
    params.push(status);
  }

  if (assigned_to !== undefined) {
    updates.push('assigned_to = ?');
    params.push(assigned_to || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update.' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      UPDATE assets
      SET ${updates.join(', ')}
      WHERE asset_id = ?
    `;
    params.push(assetId);

    const result = await conn.query(query, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    res.json({ message: 'Asset updated successfully.' });
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ error: 'Failed to update asset.' });
  } finally {
    if (conn) conn.release();
  }
});

// Only admins may remove assets from inventory (staff can add/update operational status)
router.delete('/assets/:assetId', verifyToken, requireRole('admin'), async (req, res) => {
  const { assetId } = req.params;
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query('DELETE FROM assets WHERE asset_id = ?', [assetId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Asset not found.' });
    }
    res.json({ message: 'Asset deleted successfully.' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset.' });
  } finally {
    if (conn) conn.release();
  }
});

// Get inventory logs - accessible to admin, staff, viewer
router.get('/inventory-logs', verifyToken, requireRole('admin', 'staff', 'viewer'), async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const query = `
      SELECT id, date_time, asset_id, item_name, user, action, location, status
      FROM inventory_logs
      ORDER BY date_time DESC
      LIMIT 50
    `;
    const logs = await conn.query(query);
    conn.release();

    res.json(logs);
  } catch (error) {
    console.error('Error fetching inventory logs:', error);
    res.status(500).json({ error: 'Failed to fetch inventory logs' });
  }
});

// Get security alerts - accessible to admin, staff
router.get('/security-alerts', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const query = `
      SELECT s.id, s.title, s.details, s.time, s.asset_id, s.severity, s.resolved
      FROM security_alerts s
      JOIN (
        SELECT title, details, time, asset_id, severity, MIN(id) AS min_id
        FROM security_alerts
        GROUP BY title, details, time, asset_id, severity
      ) AS unique_alerts ON unique_alerts.min_id = s.id
      ORDER BY s.time DESC
      LIMIT 50
    `;
    const alerts = await conn.query(query);
    conn.release();

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    res.status(500).json({ error: 'Failed to fetch security alerts' });
  }
});

// Update security alert status - admin only
router.put('/security-alerts/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { resolved } = req.body;

  try {
    const conn = await pool.getConnection();
    const query = `
      UPDATE security_alerts
      SET resolved = ?, resolved_at = ?
      WHERE id = ?
    `;
    const resolvedAt = resolved ? new Date() : null;
    await conn.query(query, [resolved, resolvedAt, id]);
    conn.release();

    res.json({ message: 'Alert updated successfully' });
  } catch (error) {
    console.error('Error updating security alert:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Get access control data (users) - admin only
router.get('/access-control', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const query = `
      SELECT id, username, full_name, email, role, is_2fa_enabled, is_active, created_at
      FROM users
      ORDER BY full_name
    `;
    const users = await conn.query(query);
    conn.release();

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new user (admin only)
router.post('/access-control', verifyToken, requireRole('admin'), async (req, res) => {
  const { full_name, username, email, phone, password, role } = req.body;

  if (!full_name || !username || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (!['admin', 'staff', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin, staff, or viewer.' });
  }

  try {
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const conn = await pool.getConnection();
    const query = `
      INSERT INTO users (full_name, username, email, phone, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `;
    await conn.query(query, [full_name, username, email, phone, hashedPassword, role]);
    conn.release();

    res.status(201).json({ message: 'User created successfully.' });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Get assigned tasks for staff and all complaints for admin
router.get('/assigned-complaints', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const conn = await pool.getConnection();
    let query;
    let params = [];

    if (req.user.role === 'staff') {
      query = `
        SELECT c.*, u.username as submitted_by, s.username as assigned_staff
        FROM complaints c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN users s ON c.assigned_staff_id = s.id
        WHERE c.assigned_staff_id = ?
        ORDER BY c.created_at DESC
      `;
      params = [req.user.id];
    } else {
      query = `
        SELECT c.*, u.username as submitted_by, s.username as assigned_staff
        FROM complaints c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN users s ON c.assigned_staff_id = s.id
        ORDER BY c.created_at DESC
      `;
    }

    const complaints = await conn.query(query, params);
    conn.release();

    res.json(complaints);
  } catch (error) {
    console.error('Error fetching assigned complaints:', error);
    res.status(500).json({ error: 'Failed to fetch assigned complaints' });
  }
});

// Update user role/2FA status - admin only
router.put('/access-control/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { role, is_2fa_enabled, is_active } = req.body;

  try {
    const conn = await pool.getConnection();
    const query = `
      UPDATE users
      SET role = ?, is_2fa_enabled = ?, is_active = ?
      WHERE id = ?
    `;
    await conn.query(query, [role, is_2fa_enabled, is_active, id]);
    conn.release();

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// List active staff members for admin assignment
router.get('/staff-members', verifyToken, requireRole('admin'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const staff = await conn.query(
      `SELECT id, username, full_name, email FROM users WHERE role = 'staff' AND is_active = 1 ORDER BY full_name`
    );
    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff members:', error);
    res.status(500).json({ error: 'Failed to fetch staff members' });
  } finally {
    if (conn) conn.release();
  }
});

// Get reports data - admin and staff
router.get('/reports', verifyToken, requireRole('admin', 'staff', 'viewer'), async (req, res) => {
  try {
    const conn = await pool.getConnection();

    // Get inventory overview
    const inventoryQuery = `
      SELECT
        COUNT(*) as total_assets,
        SUM(CASE WHEN status = 'checked_out' THEN 1 ELSE 0 END) as checked_out,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as under_maintenance
      FROM assets
    `;
    const inventoryStats = await conn.query(inventoryQuery);

    // Get security metrics
    const securityQuery = `
      SELECT
        COUNT(*) as total_alerts,
        SUM(CASE WHEN resolved = FALSE THEN 1 ELSE 0 END) as active_alerts,
        SUM(CASE WHEN resolved = TRUE THEN 1 ELSE 0 END) as resolved_this_month
      FROM security_alerts
      WHERE MONTH(time) = MONTH(CURRENT_DATE()) AND YEAR(time) = YEAR(CURRENT_DATE())
    `;
    const securityStats = await conn.query(securityQuery);

    // Get monthly activity summary (mock data for now)
    const monthlyActivity = [
      { month: 'April 2026', total_transactions: 342, check_outs: 189, check_ins: 153, security_incidents: 4, user_activity: '98%' },
      { month: 'March 2026', total_transactions: 415, check_outs: 234, check_ins: 181, security_incidents: 12, user_activity: '95%' },
      { month: 'February 2026', total_transactions: 387, check_outs: 201, check_ins: 186, security_incidents: 8, user_activity: '97%' },
      { month: 'January 2026', total_transactions: 398, check_outs: 215, check_ins: 183, security_incidents: 6, user_activity: '96%' },
      { month: 'December 2025', total_transactions: 423, check_outs: 228, check_ins: 195, security_incidents: 9, user_activity: '94%' }
    ];

    conn.release();

    res.json({
      inventory_overview: inventoryStats[0],
      security_metrics: {
        active_alerts: securityStats[0]?.active_alerts || 0,
        resolved_this_month: securityStats[0]?.resolved_this_month || 0,
        system_uptime: '99.9%',
        failed_access_attempts: 7
      },
      monthly_activity: monthlyActivity
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.post('/reports/export', verifyToken, requireRole('admin', 'staff', 'viewer'), async (req, res) => {
  const { email } = req.body || {};

  try {
    const conn = await pool.getConnection();
    const rows = await conn.query('SELECT email, role FROM users WHERE id = ?', [req.user.id]);
    const currentUser = rows[0];

    if (!currentUser || !currentUser.email) {
      conn.release();
      return res.status(400).json({ error: 'Your account does not have a valid email address on file. Please update your profile.' });
    }

    const targetEmail = email ? email.trim() : currentUser.email;
    if (targetEmail !== currentUser.email) {
      conn.release();
      return res.status(400).json({ error: 'Email mismatch. The address must match the one stored on your user record.' });
    }

    const inventoryQuery = `
      SELECT
        COUNT(*) as total_assets,
        SUM(CASE WHEN status = 'checked_out' THEN 1 ELSE 0 END) as checked_out,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as under_maintenance
      FROM assets
    `;
    const inventoryStats = await conn.query(inventoryQuery);

    const securityQuery = `
      SELECT
        COUNT(*) as total_alerts,
        SUM(CASE WHEN resolved = FALSE THEN 1 ELSE 0 END) as active_alerts,
        SUM(CASE WHEN resolved = TRUE THEN 1 ELSE 0 END) as resolved_this_month
      FROM security_alerts
      WHERE MONTH(time) = MONTH(CURRENT_DATE()) AND YEAR(time) = YEAR(CURRENT_DATE())
    `;
    const securityStats = await conn.query(securityQuery);

    const monthlyActivity = [
      { month: 'April 2026', total_transactions: 342, check_outs: 189, check_ins: 153, security_incidents: 4, user_activity: '98%' },
      { month: 'March 2026', total_transactions: 415, check_outs: 234, check_ins: 181, security_incidents: 12, user_activity: '95%' },
      { month: 'February 2026', total_transactions: 387, check_outs: 201, check_ins: 186, security_incidents: 8, user_activity: '97%' }
    ];

    conn.release();

    const inventory = inventoryStats[0] || {};
    const security = securityStats[0] || {};

    const csvRows = [];
    csvRows.push('Report Section,Metric,Value');
    csvRows.push(`Inventory Overview,Total Assets,${inventory.total_assets || 0}`);
    csvRows.push(`Inventory Overview,Checked Out,${inventory.checked_out || 0}`);
    csvRows.push(`Inventory Overview,Available,${inventory.available || 0}`);
    csvRows.push(`Inventory Overview,Under Maintenance,${inventory.under_maintenance || 0}`);
    csvRows.push(`Security Metrics,Active Alerts,${security.active_alerts || 0}`);
    csvRows.push(`Security Metrics,Resolved This Month,${security.resolved_this_month || 0}`);
    csvRows.push(`Security Metrics,System Uptime,99.9%`);
    csvRows.push(`Security Metrics,Failed Access Attempts,7`);
    csvRows.push('');
    csvRows.push('Monthly Activity,Month,Total Transactions,Check-Outs,Check-Ins,Security Incidents,User Activity');
    monthlyActivity.forEach((item) => {
      csvRows.push(`Monthly Activity,${item.month},${item.total_transactions},${item.check_outs},${item.check_ins},${item.security_incidents},${item.user_activity}`);
    });

    const csvContent = csvRows.join('\n');

    const mailOptions = {
      from: 'inventorysecurityengine@gmail.com',
      to: targetEmail,
      subject: 'Inventory Security Engine Report Export',
      text: 'Please find the exported report attached.',
      attachments: [
        {
          filename: 'ise-dashboard-report.csv',
          content: csvContent,
          contentType: 'text/csv'
        }
      ]
    };

    await reportMailer.sendMail(mailOptions);

    res.json({ message: 'Report exported successfully and emailed to your account.', csv: csvContent });
  } catch (error) {
    console.error('Error exporting reports:', error);
    res.status(500).json({ error: 'Failed to export reports.' });
  }
});

// Complaints system - viewers can submit, admins/staff can view and manage
router.post('/complaints', verifyToken, requireRole('viewer'), async (req, res) => {
  const { title, category, priority, description } = req.body;
  const userId = req.user.id;

  if (!title || !category || !priority || !description) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const conn = await pool.getConnection();
    const query = `
      INSERT INTO complaints (user_id, title, category, priority, description, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', NOW())
    `;
    await conn.query(query, [userId, title, category, priority, description]);
    conn.release();

    res.status(201).json({ message: 'Complaint submitted successfully' });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
});

router.get('/complaints', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const conn = await pool.getConnection();

    let query;
    let params;

    if (userRole === 'viewer') {
      // Viewers can only see their own complaints
      query = `
        SELECT c.*, u.username as submitted_by,
               s.username as assigned_staff
        FROM complaints c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN users s ON c.assigned_staff_id = s.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
      `;
      params = [userId];
    } else {
      // Admins and staff can see all complaints
      query = `
        SELECT c.*, u.username as submitted_by,
               s.username as assigned_staff
        FROM complaints c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN users s ON c.assigned_staff_id = s.id
        ORDER BY c.created_at DESC
      `;
      params = [];
    }

    const complaints = await conn.query(query, params);
    conn.release();

    res.json(complaints);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Update complaint status - admin and staff only
router.put('/complaints/:id', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  const { id } = req.params;
  const { status, assigned_staff_id } = req.body;

  try {
    const conn = await pool.getConnection();
    const query = `
      UPDATE complaints
      SET status = ?, assigned_staff_id = ?, updated_at = NOW()
      WHERE id = ?
    `;
    await conn.query(query, [status, assigned_staff_id, id]);
    conn.release();

    res.json({ message: 'Complaint updated successfully' });
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
});

// --- Viewer: order inventory (request assets) & peer trades ---

function normalizeLabel(s) {
  return (s || '').trim().toLowerCase();
}

function assetAssignedToUser(asset, userRow) {
  if (!asset || !userRow) return false;
  const a = normalizeLabel(asset.assigned_to);
  if (!a) return false;
  return a === normalizeLabel(userRow.username) || a === normalizeLabel(userRow.full_name);
}

// List other viewers (for trade partner picker)
router.get('/viewer-peers', verifyToken, requireRole('viewer'), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(
      `SELECT id, username, full_name FROM users WHERE role = 'viewer' AND is_active = 1 AND id <> ? ORDER BY username`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching viewer peers:', error);
    res.status(500).json({ error: 'Failed to fetch viewers' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/viewer-orders', verifyToken, requireRole('viewer'), async (req, res) => {
  const { asset_id, note } = req.body;
  if (!asset_id) {
    return res.status(400).json({ error: 'asset_id is required.' });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    const assets = await conn.query('SELECT asset_id FROM assets WHERE asset_id = ?', [asset_id]);
    if (!assets.length) {
      return res.status(404).json({ error: 'Asset not found.' });
    }
    const dup = await conn.query(
      `SELECT id FROM viewer_orders WHERE viewer_user_id = ? AND asset_id = ? AND status = 'pending'`,
      [req.user.id, asset_id]
    );
    if (dup.length) {
      return res.status(409).json({ error: 'You already have a pending order for this asset.' });
    }
    await conn.query(
      `INSERT INTO viewer_orders (viewer_user_id, asset_id, note, status) VALUES (?, ?, ?, 'pending')`,
      [req.user.id, asset_id, note || null]
    );
    res.status(201).json({ message: 'Order submitted. Staff will review it.' });
  } catch (error) {
    console.error('Error creating viewer order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/viewer-orders', verifyToken, async (req, res) => {
  const role = req.user.role;
  let conn;
  try {
    conn = await pool.getConnection();
    let query;
    let params = [];
    if (role === 'viewer') {
      query = `
        SELECT o.*, a.name AS asset_name, u.username AS viewer_username
        FROM viewer_orders o
        JOIN assets a ON a.asset_id = o.asset_id
        JOIN users u ON u.id = o.viewer_user_id
        WHERE o.viewer_user_id = ?
        ORDER BY o.created_at DESC
      `;
      params = [req.user.id];
    } else if (role === 'admin' || role === 'staff') {
      query = `
        SELECT o.*, a.name AS asset_name, u.username AS viewer_username, u.full_name AS viewer_full_name
        FROM viewer_orders o
        JOIN assets a ON a.asset_id = o.asset_id
        JOIN users u ON u.id = o.viewer_user_id
        ORDER BY o.created_at DESC
      `;
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }
    const rows = await conn.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching viewer orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  } finally {
    if (conn) conn.release();
  }
});

router.patch('/viewer-orders/:id', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
  const { id } = req.params;
  const { status, staff_response } = req.body;
  const allowed = ['pending', 'approved', 'rejected', 'fulfilled', 'cancelled'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(
      `UPDATE viewer_orders SET status = ?, staff_response = ?, updated_at = NOW() WHERE id = ?`,
      [status, staff_response || null, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({ message: 'Order updated.' });
  } catch (error) {
    console.error('Error updating viewer order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  } finally {
    if (conn) conn.release();
  }
});

router.post('/viewer-trades', verifyToken, requireRole('viewer'), async (req, res) => {
  const { to_user_id, offer_asset_id, request_asset_id, message } = req.body;
  if (!to_user_id || !offer_asset_id || !request_asset_id) {
    return res.status(400).json({ error: 'to_user_id, offer_asset_id, and request_asset_id are required.' });
  }
  if (parseInt(to_user_id, 10) === req.user.id) {
    return res.status(400).json({ error: 'Cannot trade with yourself.' });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    const peers = await conn.query(
      `SELECT id, username, full_name FROM users WHERE id = ? AND role = 'viewer' AND is_active = 1`,
      [to_user_id]
    );
    if (!peers.length) {
      return res.status(400).json({ error: 'Trade partner must be an active viewer.' });
    }
    const fromRows = await conn.query(`SELECT id, username, full_name FROM users WHERE id = ?`, [req.user.id]);
    const fromUser = fromRows[0];
    const toUser = peers[0];

    const offerAssets = await conn.query(`SELECT asset_id, assigned_to FROM assets WHERE asset_id = ?`, [offer_asset_id]);
    const reqAssets = await conn.query(`SELECT asset_id, assigned_to FROM assets WHERE asset_id = ?`, [request_asset_id]);
    if (!offerAssets.length || !reqAssets.length) {
      return res.status(404).json({ error: 'One or both assets not found.' });
    }
    if (!assetAssignedToUser(offerAssets[0], fromUser)) {
      return res.status(400).json({ error: 'You can only offer an asset assigned to you (username or full name must match assigned_to).' });
    }
    if (!assetAssignedToUser(reqAssets[0], toUser)) {
      return res.status(400).json({ error: 'The requested asset must be assigned to the other viewer.' });
    }

    await conn.query(
      `INSERT INTO viewer_trades (from_user_id, to_user_id, offer_asset_id, request_asset_id, message, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, to_user_id, offer_asset_id, request_asset_id, message || null]
    );
    res.status(201).json({ message: 'Trade proposal sent.' });
  } catch (error) {
    console.error('Error creating trade:', error);
    res.status(500).json({ error: 'Failed to create trade' });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/viewer-trades', verifyToken, async (req, res) => {
  const role = req.user.role;
  let conn;
  try {
    conn = await pool.getConnection();
    let query;
    let params = [];
    if (role === 'viewer') {
      query = `
        SELECT t.*,
          fu.username AS from_username, tu.username AS to_username,
          oa.name AS offer_asset_name, ra.name AS request_asset_name
        FROM viewer_trades t
        JOIN users fu ON fu.id = t.from_user_id
        JOIN users tu ON tu.id = t.to_user_id
        JOIN assets oa ON oa.asset_id = t.offer_asset_id
        JOIN assets ra ON ra.asset_id = t.request_asset_id
        WHERE t.from_user_id = ? OR t.to_user_id = ?
        ORDER BY t.created_at DESC
      `;
      params = [req.user.id, req.user.id];
    } else if (role === 'admin' || role === 'staff') {
      query = `
        SELECT t.*,
          fu.username AS from_username, tu.username AS to_username,
          oa.name AS offer_asset_name, ra.name AS request_asset_name
        FROM viewer_trades t
        JOIN users fu ON fu.id = t.from_user_id
        JOIN users tu ON tu.id = t.to_user_id
        JOIN assets oa ON oa.asset_id = t.offer_asset_id
        JOIN assets ra ON ra.asset_id = t.request_asset_id
        ORDER BY t.created_at DESC
      `;
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }
    const rows = await conn.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching viewer trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  } finally {
    if (conn) conn.release();
  }
});

router.patch('/viewer-trades/:id', verifyToken, requireRole('viewer'), async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  if (!['accept', 'reject', 'cancel'].includes(action)) {
    return res.status(400).json({ error: 'action must be accept, reject, or cancel.' });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    const trades = await conn.query(`SELECT * FROM viewer_trades WHERE id = ?`, [id]);
    if (!trades.length) {
      return res.status(404).json({ error: 'Trade not found.' });
    }
    const t = trades[0];
    if (t.status !== 'pending') {
      return res.status(400).json({ error: 'This trade is no longer pending.' });
    }

    if (action === 'cancel') {
      if (t.from_user_id !== req.user.id) {
        return res.status(403).json({ error: 'Only the sender can cancel.' });
      }
      await conn.query(`UPDATE viewer_trades SET status = 'cancelled', updated_at = NOW() WHERE id = ?`, [id]);
      return res.json({ message: 'Trade cancelled.' });
    }

    if (action === 'reject') {
      if (t.from_user_id !== req.user.id && t.to_user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not a party to this trade.' });
      }
      await conn.query(`UPDATE viewer_trades SET status = 'rejected', updated_at = NOW() WHERE id = ?`, [id]);
      return res.json({ message: 'Trade rejected.' });
    }

    // accept — only recipient
    if (t.to_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the recipient can accept.' });
    }

    const fromRows = await conn.query(`SELECT username, full_name FROM users WHERE id = ?`, [t.from_user_id]);
    const toRows = await conn.query(`SELECT username, full_name FROM users WHERE id = ?`, [t.to_user_id]);
    const fromUser = fromRows[0];
    const toUser = toRows[0];

    const offerA = await conn.query(`SELECT asset_id, assigned_to FROM assets WHERE asset_id = ?`, [t.offer_asset_id]);
    const reqA = await conn.query(`SELECT asset_id, assigned_to FROM assets WHERE asset_id = ?`, [t.request_asset_id]);
    if (!offerA.length || !reqA.length) {
      return res.status(404).json({ error: 'Assets missing.' });
    }
    if (!assetAssignedToUser(offerA[0], fromUser) || !assetAssignedToUser(reqA[0], toUser)) {
      return res.status(400).json({ error: 'Asset assignments changed; trade cannot complete.' });
    }

    const assignFrom = fromUser.username;
    const assignTo = toUser.username;

    await conn.beginTransaction();
    try {
      await conn.query(`UPDATE assets SET assigned_to = ? WHERE asset_id = ?`, [assignTo, t.offer_asset_id]);
      await conn.query(`UPDATE assets SET assigned_to = ? WHERE asset_id = ?`, [assignFrom, t.request_asset_id]);
      await conn.query(`UPDATE viewer_trades SET status = 'completed', updated_at = NOW() WHERE id = ?`, [id]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    }
    res.json({ message: 'Trade completed. Asset assignments were swapped.' });
  } catch (error) {
    console.error('Error updating trade:', error);
    res.status(500).json({ error: 'Failed to update trade' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;