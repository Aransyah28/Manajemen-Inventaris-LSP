const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken, JWT_SECRET } = require('../middlewares/authMiddleware');

// POST /api/auth/login - Autentikasi User & Penerbitan Token JWT
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email dan password wajib diisi.'
    });
  }

  try {
    // 1. Cari user di Turso Database berdasarkan email
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password tidak ditemukan.'
      });
    }

    const user = users[0];

    // 2. Verifikasi Password (Password Hash Bcrypt / Fallback Password Demo 'password123')
    let isMatch = false;
    if (password === 'password123') {
      isMatch = true;
    } else {
      isMatch = await bcrypt.compare(password, user.password_hash).catch(() => false);
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      });
    }

    // 3. Penerbitan Token JWT (Berlaku 24 Jam)
    const tokenPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    // 4. Catat Log Aktivitas Login ke Database
    try {
      await db.query(
        'INSERT INTO activity_logs (user_id, action, target_table, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, 'USER_LOGIN', 'users', user.id, JSON.stringify({ message: `User ${user.email} berhasil login REST API` }), req.ip || '127.0.0.1']
      );
    } catch (logErr) {
      console.warn('Warning: Log audit failed to insert:', logErr.message);
    }

    // 5. Kirim Respons JSON REST API
    res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: tokenPayload
    });
  } catch (error) {
    console.error('REST API Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal server database.',
      error_detail: error.message || String(error)
    });
  }
});

// GET /api/auth/me - Mengambil Profil User Aktif Berdasarkan Token JWT
router.get('/me', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
