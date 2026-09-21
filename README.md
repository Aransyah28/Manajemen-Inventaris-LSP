# Manajemen Inventaris LSP

Aplikasi full-stack (React + Express + Turso SQLite) untuk manajemen inventaris peralatan kantor. Aplikasi ini menyediakan fitur bagi petugas untuk mengelola barang dan bagi pegawai untuk melakukan peminjaman.

## Persyaratan Sistem

- Node.js (versi 16 atau lebih baru)
- npm (Node Package Manager)

## Cara Menjalankan Program

Aplikasi ini terdiri dari dua bagian: **Backend** (Express) dan **Frontend** (React/Vite).

### Setup Backend

```bash
cd Manajemen-Inventaris-LSP
npm install
cp .env.example .env
# Edit file .env dan isi TURSO_DATABASE_URL serta TURSO_AUTH_TOKEN
npm run db:init
npm run dev
```

> **Catatan Penting untuk Ujian / Penguji:**
> Sangat direkomendasikan untuk langsung menuliskan kredensial (`TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN`) di file `.env`.

#### Opsi Turso Lokal (Offline / Tanpa Cloud)
Jika ingin menjalankan database secara lokal, aplikasi ini sudah mendukung **Turso (libSQL) Lokal**. User tidak memerlukan koneksi internet ke Turso Cloud.
Cukup setel `.env` Anda seperti berikut :
```env
TURSO_DATABASE_URL="file:local.db"
TURSO_AUTH_TOKEN=""
```
Ketika Anda menjalankan `npm run db:init`, file database lokal akan otomatis dibuat di folder proyek Anda.

#### Opsi Turso Lokal (Offline / Tanpa Cloud)
Jika ingin menjalankan database secara lokal, aplikasi ini sudah mendukung **Turso (libSQL) Lokal**. Tidak memerlukan koneksi internet ke Turso Cloud.
Cukup setel `.env` seperti berikut :
```env
TURSO_DATABASE_URL="file:local.db"
TURSO_AUTH_TOKEN=""
```
Ketika menjalankan `npm run db:init`, file database lokal akan otomatis dibuat di folder proyek.


### Setup Frontend

Buka terminal baru:

```bash
cd frontend
npm install
npm run dev
```

---

## Log Bug dan Penyelesaiannya

Selama proses pengembangan, terdapat beberapa bug yang dialami beserta penyelesaiannya:

1. **Bug:** Frontend (React) tidak bisa mengambil data dari Backend API dan muncul error `CORS policy` di console browser.
   - **Penyelesaian:** Menambahkan package `cors` pada backend (`server.js`) dan mengizinkan origin dari frontend (localhost:5173).

2. **Bug:** Error koneksi ke Turso Database saat menjalankan `npm run db:init` atau saat query data.
   - **Penyelesaian:** Memastikan format `TURSO_DATABASE_URL` sudah benar (biasanya diawali dengan `libsql://`) dan `TURSO_AUTH_TOKEN` tidak expired di dalam file `.env`.

3. **Bug:** State login pada React tidak tersimpan setelah refresh halaman (pengguna langsung ter-logout).
   - **Penyelesaian:** Menggunakan `localStorage` (atau `sessionStorage`) untuk menyimpan JWT Token di sisi klien, dan menambahkan useEffect pada React untuk memvalidasi ulang token tersebut saat komponen utama dimuat (mount).

4. **Bug:** Error `nodemon: command not found` saat menjalankan `npm run dev`.
   - **Penyelesaian:** Menjalankan `npm install` di folder root untuk memastikan `nodemon` yang ada di `devDependencies` pada `package.json` terinstal di folder `node_modules` proyek, atau menginstalnya secara global dengan `npm install -g nodemon`.

5. **Bug:** Kesalahan Hak Akses (Role) — Salah membaca soal dengan memberikan hak kepada *Admin* untuk menghapus barang dan data transaksi.
   - **Penyelesaian:** Mengecek kembali soal/panduan Uji Kompetensi dan memperbaiki middleware *authorization* (seperti `requireRole`) pada *route* Express. Hak hapus kemudian disesuaikan hanya untuk *role* yang tepat sesuai dengan spesifikasi LSP.

6. **Bug:** Jam pada riwayat transaksi atau tabel ditampilkan dalam format UTC dari database (tidak sesuai dengan waktu lokal pengguna).
   - **Penyelesaian:** Mengonversi data waktu UTC tersebut ke zona waktu lokal (WIB) pada saat ditampilkan di Frontend (React) menggunakan objek `Date` bawaan JavaScript (`new Date(utcString).toLocaleString()`) agar waktu lebih mudah dibaca oleh pengguna.

---

Dibuat untuk keperluan Uji Kompetensi LSP (Lembaga Sertifikasi Profesi).
