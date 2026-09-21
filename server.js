const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const loanRoutes = require('./routes/loans');
const logRoutes = require('./routes/logs');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middleware CORS & JSON Body Parser
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Registrasi Router REST API
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/logs', logRoutes);

// 3. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API Backend Inventaris LSP (Turso DB) berjalan dengan baik.',
    timestamp: new Date().toISOString()
  });
});

// 4. Menjalankan Server REST API
app.listen(PORT, () => {
  console.log(`===========================================================`);
  console.log(`Server REST API Inventaris LSP berjalan di port: ${PORT}`);
  console.log(`Health Check URL: http://localhost:${PORT}/api/health`);
  console.log(`===========================================================`);
});

module.exports = app;
