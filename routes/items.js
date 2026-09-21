const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

// 1. GET /api/items - Mengambil Katalog Barang Inventaris (Filter Search, Category, Status)
router.get('/', verifyToken, async (req, res) => {
  const { search, category, status } = req.query;

  try {
    let sql = `
      SELECT i.*, c.name AS category_name 
      FROM items i 
      LEFT JOIN categories c ON i.category_id = c.id 
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (i.name LIKE ? OR i.item_code LIKE ? OR i.brand LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) {
      sql += ` AND i.category_id = ?`;
      params.push(category);
    }
    if (status) {
      sql += ` AND i.availability_status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY i.id DESC`;

    const [items] = await db.query(sql, params);

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error fetching items API:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data barang dari Turso Database.'
    });
  }
});

// 2. GET /api/items/categories - Mengambil Daftar Kategori Barang
router.get('/categories', verifyToken, async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM categories ORDER BY name ASC');
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories API:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data kategori.'
    });
  }
});

// 3. POST /api/items - Menambah Data Barang Baru (Petugas Only)
router.post('/', verifyToken, requireRole('petugas'), async (req, res) => {
  const { item_code, name, category_id, brand, serial_number, total_qty, location, condition_status } = req.body;

  if (!item_code || !name || !category_id || !location) {
    return res.status(400).json({
      success: false,
      message: 'Kode barang, nama, kategori, dan lokasi wajib diisi.'
    });
  }

  try {
    const qty = parseInt(total_qty) || 1;

    await db.query(
      `INSERT INTO items 
       (item_code, name, category_id, brand, serial_number, total_qty, available_qty, location, condition_status, availability_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'tersedia')`,
      [item_code, name, category_id, brand || null, serial_number || null, qty, qty, location, condition_status || 'baik']
    );

    // Audit Activity Log
    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'ITEM_CREATE', 'items', JSON.stringify({ item_code, name, qty }), req.ip || '127.0.0.1']
    );

    res.status(201).json({
      success: true,
      message: 'Data barang inventaris berhasil ditambahkan.'
    });
  } catch (error) {
    console.error('Error creating item API:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menambah data barang. Pastikan Kode Barang unik.'
    });
  }
});

// 4. PUT /api/items/:id - Memperbarui Data/Kondisi Barang (Petugas Only)
router.put('/:id', verifyToken, requireRole('petugas'), async (req, res) => {
  const itemId = req.params.id;
  const { name, brand, total_qty, available_qty, location, condition_status, availability_status } = req.body;

  try {
    await db.query(
      `UPDATE items 
       SET name = ?, brand = ?, total_qty = ?, available_qty = ?, location = ?, condition_status = ?, availability_status = ? 
       WHERE id = ?`,
      [name, brand, total_qty, available_qty, location, condition_status, availability_status, itemId]
    );

    // Audit Log
    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'ITEM_UPDATE', 'items', itemId, JSON.stringify({ name, condition_status, availability_status })]
    );

    res.json({
      success: true,
      message: 'Data barang berhasil diperbarui.'
    });
  } catch (error) {
    console.error('Error updating item API:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui data barang.'
    });
  }
});

// 5. DELETE /api/items/:id - Menghapus Barang (Petugas Only)
router.delete('/:id', verifyToken, requireRole('petugas'), async (req, res) => {
  const itemId = req.params.id;

  try {
    await db.query('DELETE FROM items WHERE id = ?', [itemId]);

    await db.query(
      'INSERT INTO activity_logs (user_id, action, target_table, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'ITEM_DELETE', 'items', itemId, JSON.stringify({ message: `Hapus item ID ${itemId}` })]
    );

    res.json({
      success: true,
      message: 'Data barang inventaris berhasil dihapus.'
    });
  } catch (error) {
    console.error('Error deleting item API:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus barang. Barang mungkin terikat dengan transaksi peminjaman.'
    });
  }
});

module.exports = router;
