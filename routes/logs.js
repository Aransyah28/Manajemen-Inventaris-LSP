const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

// 1. GET /api/logs - Memantau Audit Activity Logs Real-Time (Admin Only)
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [logs] = await db.query(`
      SELECT a.*, u.name AS user_name, u.email AS user_email, u.role AS user_role 
      FROM activity_logs a 
      LEFT JOIN users u ON a.user_id = u.id 
      ORDER BY a.id DESC 
      LIMIT 100
    `);

    // Parse string JSON details menjadi Javascript Object
    const parsedLogs = logs.map(log => {
      let detailsObj = null;
      try {
        detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      } catch (e) {
        detailsObj = log.details;
      }
      return {
        ...log,
        details: detailsObj
      };
    });

    res.json({
      success: true,
      data: parsedLogs
    });
  } catch (error) {
    console.error('Error fetching activity logs API:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data log aktivitas dari Turso Database.'
    });
  }
});

// 2. GET /api/logs/summary - Laporan Rekapitulasi Statistik Inventaris & Peminjaman (Admin Only)
router.get('/summary', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // Agregasi Statistik Barang Inventaris
    const [[itemStats]] = await db.query(`
      SELECT 
        COUNT(id) AS total_items,
        SUM(total_qty) AS grand_total_qty,
        SUM(available_qty) AS grand_available_qty,
        SUM(CASE WHEN condition_status != 'baik' THEN 1 ELSE 0 END) AS damaged_count,
        SUM(CASE WHEN availability_status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance_count
      FROM items
    `);

    // Agregasi Statistik Peminjaman
    const [[loanStats]] = await db.query(`
      SELECT 
        COUNT(id) AS total_loans,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_loans,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS active_loans,
        SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) AS returned_loans,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_loans
      FROM loan_requests
    `);

    res.json({
      success: true,
      data: {
        inventory: itemStats,
        loans: loanStats
      }
    });
  } catch (error) {
    console.error('Error fetching report summary API:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data laporan agregasi rekapitulasi.'
    });
  }
});

module.exports = router;
