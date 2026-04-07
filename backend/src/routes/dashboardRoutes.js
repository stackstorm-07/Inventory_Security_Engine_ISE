const express = require('express');
const pool = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

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

// Get reports data - admin and staff
router.get('/reports', verifyToken, requireRole('admin', 'staff'), async (req, res) => {
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

module.exports = router;