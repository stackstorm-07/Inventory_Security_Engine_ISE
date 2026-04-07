const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

// Get inventory logs - accessible to admin, manager, user
router.get('/inventory-logs', verifyToken, requireRole('admin', 'manager', 'user'), async (req, res) => {
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

// Get security alerts - accessible to admin, manager
router.get('/security-alerts', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const query = `
      SELECT id, title, details, time, asset_id, severity, resolved
      FROM security_alerts
      ORDER BY time DESC
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
      SELECT id, username, full_name, email, role, department, status, last_login
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

// Update user role/status - admin only
router.put('/access-control/:id', verifyToken, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { role, department, status } = req.body;

  try {
    const conn = await pool.getConnection();
    const query = `
      UPDATE users
      SET role = ?, department = ?, status = ?
      WHERE id = ?
    `;
    await conn.query(query, [role, department, status, id]);
    conn.release();

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get reports data - admin and manager
router.get('/reports', verifyToken, requireRole('admin', 'manager'), async (req, res) => {
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

module.exports = router;