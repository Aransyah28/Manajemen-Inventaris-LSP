-- ============================================================================
-- SCRIPT DATABASE TURSO CLOUD / LIBSQL - MANAJEMEN INVENTARIS LSP
-- Target Database: Turso Cloud (`libsql://...`) & SQLite Engine
-- ============================================================================

-- Drop Tabel Lama jika Ada (Clean Reset Order)
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS loan_requests;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- 1. TABEL USERS (Manajemen Pengguna & Pengaturan Role)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'petugas', 'staff')),
    phone TEXT NULL,
    department TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABEL CATEGORIES (Kategori Barang Inventaris)
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABEL ITEMS (Data Inventaris Barang Kantor)
CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    brand TEXT NULL,
    serial_number TEXT NULL UNIQUE,
    condition_status TEXT NOT NULL DEFAULT 'baik' CHECK (condition_status IN ('baik', 'rusak_ringan', 'rusak_berat')),
    availability_status TEXT NOT NULL DEFAULT 'tersedia' CHECK (availability_status IN ('tersedia', 'dipinjam', 'maintenance')),
    total_qty INTEGER NOT NULL DEFAULT 1 CHECK (total_qty >= 0),
    available_qty INTEGER NOT NULL DEFAULT 1 CHECK (available_qty >= 0),
    location TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

-- 4. TABEL LOAN_REQUESTS (Transaksi Peminjaman & Pengembalian Barang)
CREATE TABLE loan_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
    loan_date TEXT NOT NULL,
    expected_return_date TEXT NOT NULL,
    actual_return_date TEXT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'returned', 'overdue')),
    notes TEXT NULL,
    approved_by INTEGER NULL,
    approval_date DATETIME NULL,
    rejection_reason TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (item_id) REFERENCES items(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- 5. TABEL ACTIVITY_LOGS (Audit Trail / Log Aktivitas System)
CREATE TABLE activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NULL,
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id INTEGER NULL,
    details TEXT NULL, -- Stored as JSON String
    ip_address TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- DATA BENIH INSIALISASI (SEED DATA)
-- ============================================================================

-- Data Pengguna Default (Password hash default: 'password123' via bcrypt)
INSERT INTO users (name, email, password_hash, role, department) VALUES
('Super Admin Logistik', 'admin@lsp.logistik.go.id', '$2b$10$w8T0M./z7F93E4L./8h9oO3Jk2lM9bU6qX.c1bV5aX.Y7zZ8aX9bW', 'admin', 'TI & Logistik'),
('Budi Petugas Logistik', 'budi.petugas@lsp.logistik.go.id', '$2b$10$w8T0M./z7F93E4L./8h9oO3Jk2lM9bU6qX.c1bV5aX.Y7zZ8aX9bW', 'petugas', 'Gudang & Logistik'),
('Siti Staff Operasional', 'siti.staff@lsp.logistik.go.id', '$2b$10$w8T0M./z7F93E4L./8h9oO3Jk2lM9bU6qX.c1bV5aX.Y7zZ8aX9bW', 'staff', 'Keuangan & SDM');

-- Data Kategori Inventaris
INSERT INTO categories (name, description) VALUES
('Komputer & Laptop', 'Perangkat komputer kerja, laptop, dan unit server mini'),
('Proyektor & AV', 'Proyektor LCD, layar proyektor, kabel HDMI, dan pengeras suara'),
('Mebel & Ergonomi', 'Meja kerja, kursi kantor ergonomis, dan lemari arsip');

-- Data Barang Inventaris Awal
INSERT INTO items (item_code, name, category_id, brand, serial_number, condition_status, availability_status, total_qty, available_qty, location) VALUES
('BRG-KMP-001', 'Laptop Dell Latitude 5420 i7 16GB', 1, 'Dell', 'SN-DEL-984201', 'baik', 'tersedia', 5, 4, 'Ruang IT Lt. 2'),
('BRG-PRJ-001', 'Proyektor Epson EB-X51 3800 Lumens', 2, 'Epson', 'SN-EPS-440192', 'baik', 'dipinjam', 2, 1, 'Gudang Logistik Lt. 1'),
('BRG-MBL-001', 'Kursi Kerja Ergonomis Herman Miller', 3, 'Herman Miller', 'SN-HM-001928', 'baik', 'tersedia', 10, 10, 'Gudang Logistik Lt. 1');

-- Data Transaksi Peminjaman Awal
INSERT INTO loan_requests (request_number, user_id, item_id, qty, loan_date, expected_return_date, actual_return_date, status, notes, approved_by, approval_date) VALUES
('REQ-20260901-001', 3, 2, 1, '2026-09-01', '2026-09-05', '2026-09-05', 'returned', 'Peminjaman proyektor untuk presentasi rapat', 2, '2026-09-01 08:30:00');

-- Data Audit Log Awal
INSERT INTO activity_logs (user_id, action, target_table, target_id, details, ip_address) VALUES
(1, 'SYSTEM_INIT', 'users', 1, '{"message": "Inisialisasi database Turso Cloud berhasil"}', '127.0.0.1');
