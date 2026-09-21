const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

// 1. GET /api/loans - Mengambil Daftar Peminjaman (Staff hanya lihat miliknya, Petugas/Admin lihat semua)
router.get('/', verifyToken, async (req, res) => {
  const user = req.user;

  try {
    let sql = `
      SELECT l.*, u.name AS user_name, u.email AS user_email, i.name AS item_name, i.item_code, ap.name AS approver_name 
      FROM loan_requests l
      JOIN users u ON l.user_id = u.id
      JOIN items i ON l.item_id = i.id
      LEFT JOIN users ap ON l.approved_by = ap.id
    `;
    const params = [];

    // Jika peran Staff, batasi hanya melihat transaksi miliknya
    if (user.role === 'staff') {
      sql += ` WHERE l.user_id = ?`;
      params.push(user.id);
    }

    sql += ` ORDER BY l.id DESC`;

    const [loans] = await db.query(sql, params);

    res.json({
      success: true,
      data: loans
    });
  } catch (error) {
    console.error('Error fetching loans API:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data transaksi peminjaman.'
    });
  }
});

// 2. POST /api/loans - Staff Mengajukan Permohonan Peminjaman Barang Baru
router.post('/', verifyToken, requireRole('staff'), async (req, res) => {
  const { item_id, qty, loan_date, expected_return_date, notes } = req.body;
  const userId = req.user.id;

  if (!item_id || !qty || !loan_date || !expected_return_date) {
    return res.status(400).json({
      success: false,
      message: 'ID barang, kuota, tanggal pinjam, dan target tanggal kembali wajib diisi.'
    });
  }

  try {
    const requestedQty = parseInt(qty) || 1;

    // Cek ketersediaan stok barang di Turso DB
    const [items] = await db.query('SELECT * FROM items WHERE id = ?', [item_id]);
    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Barang inventaris tidak ditemukan.'
      });
    }

    const item = items[0];
    if (item.available_qty < requestedQty) {
      return res.status(400).json({
        success: false,
        message: `Stok ketersediaan barang tidak mencukupi. Stok tersedia: ${item.available_qty}`
      });
    }

    // Generate Tiket Unik (misal: REQ-20260921-8492)
    const requestNumber = 'REQ-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(1000 + Math.random() * 9000);

    await db.query(
      `INSERT INTO loan_requests 
       (request_number, user_id, item_id, qty, loan_date, expected_return_date, status, notes) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [requestNumber, userId, item_id, requestedQty, loan_date, expected_return_date, notes || '']
    );

    // Audit Log
    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, details) VALUES (?, ?, ?, ?)',
      [userId, 'LOAN_REQUEST_CREATE', 'loan_requests', JSON.stringify({ requestNumber, item_code: item.item_code, qty: requestedQty })]
    );

    res.status(201).json({
      success: true,
      message: 'Permohonan peminjaman berhasil diajukan! Menunggu persetujuan Petugas.',
      request_number: requestNumber
    });
  } catch (error) {
    console.error('Error submitting loan request API:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengajukan permohonan peminjaman.'
    });
  }
});

// 3. PATCH /api/loans/:id/approve - Petugas Menyetujui Peminjaman & Kurangi Stok Otomatis
router.patch('/:id/approve', verifyToken, requireRole('petugas'), async (req, res) => {
  const loanId = req.params.id;

  try {
    // 1. Ambil data tiket peminjaman
    const [loans] = await db.query('SELECT * FROM loan_requests WHERE id = ?', [loanId]);
    if (loans.length === 0) {
      return res.status(404).json({ success: false, message: 'Tiket peminjaman tidak ditemukan.' });
    }
    const loan = loans[0];

    if (loan.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Hanya permohonan berstatus pending yang dapat disetujui.' });
    }

    // 2. Cek ketersediaan stok barang
    const [items] = await db.query('SELECT * FROM items WHERE id = ?', [loan.item_id]);
    const item = items[0];

    if (item.available_qty < loan.qty) {
      return res.status(400).json({
        success: false,
        message: `Gagal menyetujui: Stok ketersediaan tidak mencukupi. Tersedia: ${item.available_qty}, diminta: ${loan.qty}`
      });
    }

    // 3. Update status tiket peminjaman -> approved
    await db.query(
      `UPDATE loan_requests 
       SET status = 'approved', approved_by = ?, approval_date = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [req.user.id, loanId]
    );

    // 4. Update stok barang -> kurangi available_qty
    const newAvailableQty = item.available_qty - loan.qty;
    const newStatus = newAvailableQty === 0 ? 'dipinjam' : item.availability_status;

    await db.query(
      `UPDATE items SET available_qty = ?, availability_status = ? WHERE id = ?`,
      [newAvailableQty, newStatus, item.id]
    );

    // 5. Audit Log
    await db.query(
      `INSERT INTO activity_logs (user_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'LOAN_APPROVE', 'loan_requests', loanId, JSON.stringify({ request_number: loan.request_number, approved_qty: loan.qty })]
    );

    res.json({
      success: true,
      message: 'Peminjaman berhasil disetujui dan stok ketersediaan barang telah diperbarui.'
    });
  } catch (error) {
    console.error('Approve Loan API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memproses persetujuan peminjaman.'
    });
  }
});

// 4. PATCH /api/loans/:id/reject - Petugas Menolak Peminjaman
router.patch('/:id/reject', verifyToken, requireRole('petugas'), async (req, res) => {
  const loanId = req.params.id;
  const { rejection_reason } = req.body;

  try {
    await db.query(
      `UPDATE loan_requests 
       SET status = 'rejected', approved_by = ?, rejection_reason = ? 
       WHERE id = ?`,
      [req.user.id, rejection_reason || 'Ditolak oleh petugas logistik', loanId]
    );

    await db.query(
      `INSERT INTO activity_logs (user_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'LOAN_REJECT', 'loan_requests', loanId, JSON.stringify({ reason: rejection_reason })]
    );

    res.json({
      success: true,
      message: 'Permohonan peminjaman telah ditolak.'
    });
  } catch (error) {
    console.error('Reject Loan API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menolak peminjaman.'
    });
  }
});

// 5. PATCH /api/loans/:id/return - Memproses Pengembalian Barang & Mengembalikan Kuota Stok
router.patch('/:id/return', verifyToken, requireRole('petugas'), async (req, res) => {
  const loanId = req.params.id;

  try {
    const [loans] = await db.query('SELECT * FROM loan_requests WHERE id = ?', [loanId]);
    if (loans.length === 0) {
      return res.status(404).json({ success: false, message: 'Data peminjaman tidak ditemukan.' });
    }
    const loan = loans[0];

    if (loan.status !== 'approved' && loan.status !== 'overdue') {
      return res.status(400).json({ success: false, message: 'Hanya transaksi berstatus approved/overdue yang dapat dikembalikan.' });
    }

    // 1. Update status peminjaman -> returned
    await db.query(
      `UPDATE loan_requests 
       SET status = 'returned', actual_return_date = DATE('now') 
       WHERE id = ?`,
      [loanId]
    );

    // 2. Kembalikan kuota stok ketersediaan barang
    const [items] = await db.query('SELECT * FROM items WHERE id = ?', [loan.item_id]);
    const item = items[0];

    const newAvailableQty = item.available_qty + loan.qty;
    await db.query(
      `UPDATE items 
       SET available_qty = ?, availability_status = 'tersedia' 
       WHERE id = ?`,
      [newAvailableQty, item.id]
    );

    // 3. Audit Log
    await db.query(
      `INSERT INTO activity_logs (user_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, 'LOAN_RETURN', 'loan_requests', loanId, JSON.stringify({ request_number: loan.request_number, returned_qty: loan.qty })]
    );

    res.json({
      success: true,
      message: 'Pengembalian barang berhasil dicatat dan stok ketersediaan barang telah dikembalikan!'
    });
  } catch (error) {
    console.error('Return Loan API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memproses pengembalian barang.'
    });
  }
});

module.exports = router;
