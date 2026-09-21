const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_lsp_inventaris_2026';

/**
 * Middleware Verifikasi Token JWT
 * Memastikan request memiliki token valid di header Authorization: Bearer <token>
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Akses Ditolak: Token autentikasi tidak ditemukan.'
    });
  }

  // Format header: Bearer <TOKEN>
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Menyimpan data user (id, name, email, role) ke object request
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid atau telah kadaluwarsa.'
    });
  }
}

/**
 * Middleware Otorisasi Peran (Role Guard / RBAC)
 * Memastikan pengguna memiliki peran yang diizinkan (misal: 'admin', 'petugas')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses Ditolak: Diperlukan hak akses [${allowedRoles.join(' / ')}].`
      });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  requireRole,
  JWT_SECRET
};
