import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3000/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('lsp_token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('lsp_user') || 'null'));
  const [activeTab, setActiveTab] = useState('items');
  const [msg, setMsg] = useState({ error: '', success: '' });

  // State Data Master
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loans, setLoans] = useState([]);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);

  // State Form Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('password123');

  // State Form Tambah Barang
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    item_code: '', name: '', category_id: '', brand: '', total_qty: 1, location: '', condition_status: 'baik'
  });

  // State Form Pengajuan Peminjaman
  const [newLoan, setNewLoan] = useState({
    item_id: '', qty: 1, loan_date: new Date().toISOString().slice(0, 10), expected_return_date: '', notes: ''
  });

  // Handle Login
  const handleLogin = async (emailToUse, passToUse) => {
    setMsg({ error: '', success: '' });
    const email = emailToUse || loginEmail;
    const password = passToUse || loginPass;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('lsp_token', data.token);
        localStorage.setItem('lsp_user', JSON.stringify(data.user));
        setMsg({ success: 'Login berhasil.', error: '' });
      } else {
        setMsg({ error: data.message, success: '' });
      }
    } catch (err) {
      setMsg({ error: 'Gagal terhubung ke API server.', success: '' });
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('lsp_token');
    localStorage.removeItem('lsp_user');
  };

  // Fetch Items & Categories
  const fetchItems = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setItems(data.data);

      const resCat = await fetch(`${API_BASE}/items/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataCat = await resCat.json();
      if (dataCat.success) {
        setCategories(dataCat.data);
        if (dataCat.data.length > 0 && !newItem.category_id) {
          setNewItem(prev => ({ ...prev, category_id: dataCat.data[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Loans
  const fetchLoans = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/loans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setLoans(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Logs & Summary (Admin Only)
  const fetchLogs = async () => {
    if (!token || user?.role !== 'admin') return;
    try {
      const resLogs = await fetch(`${API_BASE}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataLogs = await resLogs.json();
      if (dataLogs.success) setLogs(dataLogs.data);

      const resSum = await fetch(`${API_BASE}/logs/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataSum = await resSum.json();
      if (dataSum.success) setSummary(dataSum.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchItems();
      fetchLoans();
      if (user?.role === 'admin') fetchLogs();
    }
  }, [token, activeTab]);

  // Handle Tambah Barang (Petugas / Admin)
  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newItem)
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ success: 'Data barang berhasil ditambahkan.', error: '' });
        setShowAddItem(false);
        fetchItems();
      } else {
        setMsg({ error: data.message, success: '' });
      }
    } catch (err) {
      setMsg({ error: 'Gagal menambah data barang.', success: '' });
    }
  };

  // Handle Hapus Barang (Admin Only)
  const handleDeleteItem = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus barang ini?')) return;
    try {
      const res = await fetch(`${API_BASE}/items/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ success: 'Data barang berhasil dihapus.', error: '' });
        fetchItems();
      } else {
        setMsg({ error: data.message, success: '' });
      }
    } catch (err) {
      setMsg({ error: 'Gagal menghapus data barang.', success: '' });
    }
  };

  // Handle Pengajuan Peminjaman (Staff)
  const handleCreateLoan = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newLoan)
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ success: 'Permohonan peminjaman berhasil diajukan.', error: '' });
        fetchLoans();
        fetchItems();
      } else {
        setMsg({ error: data.message, success: '' });
      }
    } catch (err) {
      setMsg({ error: 'Gagal mengajukan permohonan peminjaman.', success: '' });
    }
  };

  // Handle Action Loan (Approve / Reject / Return)
  const handleActionLoan = async (id, action, bodyObj = {}) => {
    try {
      const res = await fetch(`${API_BASE}/loans/${id}/${action}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(bodyObj)
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ success: data.message, error: '' });
        fetchLoans();
        fetchItems();
      } else {
        setMsg({ error: data.message, success: '' });
      }
    } catch (err) {
      setMsg({ error: 'Gagal memproses transaksi peminjaman.', success: '' });
    }
  };

  // IF NOT LOGGED IN -> RENDER LOGIN VIEW
  if (!token || !user) {
    return (
      <div className="container" style={{ maxWidth: '420px', marginTop: '60px' }}>
        <h2 style={{ textAlign: 'center', marginTop: 0, color: '#0f172a', fontSize: '1.4rem' }}>Autentikasi Pengguna</h2>
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '20px' }}>Sistem Informasi Manajemen Inventaris Peralatan Kantor</p>

        {msg.error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '0.85rem' }}>{msg.error}</div>}

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Alamat Email:</label>
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required placeholder="admin@lsp.logistik.go.id" />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Kata Sandi:</label>
            <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>Masuk Sistem</button>
        </form>

        <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid #e2e8f0' }}>
          <strong style={{ color: '#334155' }}>Preset Akun Pengujian (Password: password123):</strong>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button className="btn btn-secondary" onClick={() => { setLoginEmail('admin@lsp.logistik.go.id'); handleLogin('admin@lsp.logistik.go.id', 'password123'); }}>Masuk Sebagai Admin</button>
            <button className="btn btn-secondary" onClick={() => { setLoginEmail('budi.petugas@lsp.logistik.go.id'); handleLogin('budi.petugas@lsp.logistik.go.id', 'password123'); }}>Masuk Sebagai Petugas Logistik</button>
            <button className="btn btn-secondary" onClick={() => { setLoginEmail('siti.staff@lsp.logistik.go.id'); handleLogin('siti.staff@lsp.logistik.go.id', 'password123'); }}>Masuk Sebagai Staff</button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN RENDER DASHBOARD
  return (
    <div>
      <header>
        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', letterSpacing: '0.5px' }}>INVENTARIS LOGISTIK</div>
        <nav style={{ display: 'flex', alignItems: 'center' }}>
          <button className={activeTab === 'items' ? 'active' : ''} onClick={() => setActiveTab('items')}>Katalog Inventaris</button>
          <button className={activeTab === 'loans' ? 'active' : ''} onClick={() => setActiveTab('loans')}>Transaksi Peminjaman</button>
          {user.role === 'admin' && (
            <button className={activeTab === 'logs' ? 'active' : ''} onClick={() => setActiveTab('logs')}>Audit Log & Laporan</button>
          )}
          <span style={{ marginLeft: '15px', color: '#94a3b8', fontSize: '0.85rem' }}>
            Pengguna: {user.name} | Peran: <strong style={{ color: '#38bdf8' }}>{user.role.toUpperCase()}</strong>
          </span>
          <button onClick={handleLogout} className="btn btn-danger" style={{ marginLeft: '15px' }}>Keluar</button>
        </nav>
      </header>

      {msg.success && <div className="container" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '10px', fontSize: '0.85rem' }}>{msg.success}</div>}
      {msg.error && <div className="container" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '10px', fontSize: '0.85rem' }}>{msg.error}</div>}

      {/* TAB 1: KATALOG BARANG */}
      {activeTab === 'items' && (
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Katalog Inventaris Peralatan Kantor</h3>
            {(user.role === 'admin' || user.role === 'petugas') && (
              <button className="btn btn-success" onClick={() => setShowAddItem(!showAddItem)}>
                {showAddItem ? 'Batal' : 'Tambah Barang Baru'}
              </button>
            )}
          </div>

          {showAddItem && (
            <form onSubmit={handleAddItem} style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div>
                <label>Kode Barang:</label>
                <input type="text" value={newItem.item_code} onChange={e => setNewItem({ ...newItem, item_code: e.target.value })} required placeholder="BRG-KMP-009" />
              </div>
              <div>
                <label>Nama Barang:</label>
                <input type="text" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} required placeholder="Laptop Lenovo ThinkPad" />
              </div>
              <div>
                <label>Kategori:</label>
                <select value={newItem.category_id} onChange={e => setNewItem({ ...newItem, category_id: e.target.value })}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>Merek:</label>
                <input type="text" value={newItem.brand} onChange={e => setNewItem({ ...newItem, brand: e.target.value })} placeholder="Lenovo" />
              </div>
              <div>
                <label>Jumlah Stok Total:</label>
                <input type="number" value={newItem.total_qty} onChange={e => setNewItem({ ...newItem, total_qty: e.target.value })} min="1" required />
              </div>
              <div>
                <label>Lokasi Penyimpanan:</label>
                <input type="text" value={newItem.location} onChange={e => setNewItem({ ...newItem, location: e.target.value })} required placeholder="Ruang IT Lt. 2" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-success">Simpan Data Barang</button>
              </div>
            </form>
          )}

          <table>
            <thead>
              <tr>
                <th>Kode Barang</th>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th>Merek</th>
                <th>Lokasi</th>
                <th>Kondisi</th>
                <th>Stok (Tersedia / Total)</th>
                <th>Status Ketersediaan</th>
                {user.role === 'admin' && <th>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td><code>{item.item_code}</code></td>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.category_name || '-'}</td>
                  <td>{item.brand || '-'}</td>
                  <td>{item.location}</td>
                  <td><span className={`badge ${item.condition_status === 'baik' ? 'badge-success' : 'badge-danger'}`}>{item.condition_status}</span></td>
                  <td><strong>{item.available_qty}</strong> / {item.total_qty} unit</td>
                  <td><span className={`badge ${item.availability_status === 'tersedia' ? 'badge-success' : 'badge-warning'}`}>{item.availability_status}</span></td>
                  {user.role === 'admin' && (
                    <td>
                      <button className="btn btn-danger" onClick={() => handleDeleteItem(item.id)}>Hapus</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: TRANSAKSI PEMINJAMAN */}
      {activeTab === 'loans' && (
        <div className="container">
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#0f172a' }}>Daftar Transaksi Peminjaman Inventaris</h3>

          {(user.role === 'staff' || user.role === 'admin') && (
            <form onSubmit={handleCreateLoan} style={{ background: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ gridColumn: '1 / -1' }}><h4 style={{ margin: 0, color: '#334155' }}>Form Pengajuan Peminjaman (Staff)</h4></div>
              <div>
                <label>Pilih Barang (Stok Tersedia):</label>
                <select value={newLoan.item_id} onChange={e => setNewLoan({ ...newLoan, item_id: e.target.value })} required>
                  <option value="">-- Pilih Barang --</option>
                  {items.filter(i => i.available_qty > 0).map(i => (
                    <option key={i.id} value={i.id}>{i.name} [{i.item_code}] - Tersedia: {i.available_qty} unit</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Jumlah Unit Dipinjam:</label>
                <input type="number" value={newLoan.qty} onChange={e => setNewLoan({ ...newLoan, qty: e.target.value })} min="1" required />
              </div>
              <div>
                <label>Target Tanggal Kembali:</label>
                <input type="date" value={newLoan.expected_return_date} onChange={e => setNewLoan({ ...newLoan, expected_return_date: e.target.value })} required />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Keperluan / Catatan Peminjaman:</label>
                <input type="text" value={newLoan.notes} onChange={e => setNewLoan({ ...newLoan, notes: e.target.value })} placeholder="Dinas luar kota / Rapat Kementerian" required />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-success">Kirim Permohonan Peminjaman</button>
              </div>
            </form>
          )}

          <table>
            <thead>
              <tr>
                <th>No. Tiket</th>
                <th>Peminjam</th>
                <th>Barang</th>
                <th>Jumlah</th>
                <th>Tgl Pinjam</th>
                <th>Target Kembali</th>
                <th>Status Transaksi</th>
                <th>Verifikator</th>
                {(user.role === 'admin' || user.role === 'petugas') && <th>Aksi Pemrosesan</th>}
              </tr>
            </thead>
            <tbody>
              {loans.map(loan => (
                <tr key={loan.id}>
                  <td><code>{loan.request_number}</code></td>
                  <td><strong>{loan.user_name}</strong></td>
                  <td>{loan.item_name}</td>
                  <td><strong>{loan.qty}</strong> unit</td>
                  <td>{loan.loan_date}</td>
                  <td>{loan.expected_return_date}</td>
                  <td>
                    <span className={`badge ${loan.status === 'pending' ? 'badge-warning' : loan.status === 'approved' ? 'badge-info' : loan.status === 'returned' ? 'badge-success' : 'badge-danger'}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td>{loan.approver_name || '-'}</td>
                  {(user.role === 'admin' || user.role === 'petugas') && (
                    <td>
                      {loan.status === 'pending' && (
                        <>
                          <button className="btn btn-success" onClick={() => handleActionLoan(loan.id, 'approve')}>Setujui</button>
                          <button className="btn btn-danger" onClick={() => handleActionLoan(loan.id, 'reject', { rejection_reason: 'Stok diprioritaskan' })}>Tolak</button>
                        </>
                      )}
                      {loan.status === 'approved' && (
                        <button className="btn btn-primary" onClick={() => handleActionLoan(loan.id, 'return')}>Proses Pengembalian</button>
                      )}
                      {loan.status === 'returned' && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Selesai</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS & REPORTS (ADMIN ONLY) */}
      {activeTab === 'logs' && user.role === 'admin' && (
        <div className="container">
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#0f172a' }}>Rekap Laporan & Audit Logs System</h3>

          {summary && (
            <div className="stats-grid">
              <div className="stat-card"><h3>{summary.inventory.total_items}</h3><p>Jenis Barang</p></div>
              <div className="stat-card"><h3>{summary.inventory.grand_total_qty} unit</h3><p>Total Unit Aset</p></div>
              <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}><h3>{summary.inventory.grand_available_qty} unit</h3><p>Stok Tersedia</p></div>
              <div className="stat-card" style={{ borderLeft: '4px solid #2563eb' }}><h3>{summary.loans.active_loans}</h3><p>Peminjaman Aktif</p></div>
              <div className="stat-card"><h3>{summary.loans.total_loans}</h3><p>Total Transaksi</p></div>
            </div>
          )}

          <h4 style={{ margin: '20px 0 10px 0', color: '#334155' }}>Audit Trail Activity Log (Turso Cloud Database)</h4>
          <table>
            <thead>
              <tr>
                <th>ID Log</th>
                <th>Waktu (Timestamp)</th>
                <th>Pengguna</th>
                <th>Peran</th>
                <th>Nama Aksi</th>
                <th>Tabel Sasaran</th>
                <th>Detail Transaksi</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td>#{l.id}</td>
                  <td>{new Date(l.created_at).toLocaleString('id-ID')}</td>
                  <td><strong>{l.user_name || 'System'}</strong></td>
                  <td><span className="badge badge-info">{l.user_role || 'ADMIN'}</span></td>
                  <td><code>{l.action}</code></td>
                  <td>{l.target_table}</td>
                  <td><pre style={{ margin: 0, fontSize: '0.75rem' }}>{JSON.stringify(l.details)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
