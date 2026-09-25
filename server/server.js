const http = require('http');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { getDb } = require('./db/database');
const { performBackup } = require('./services/backupService');

// Initialize database schema on startup
getDb();

// Daily startup backup check
const backupStatus = performBackup(false);
if (backupStatus.skipped) {
  console.log(`[Backup] ${backupStatus.message}`);
} else if (backupStatus.success) {
  console.log(`[Backup] Automated daily backup created: ${backupStatus.filename}`);
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const { authMiddleware } = require('./middleware/auth');

// Public routes (no auth required)
app.get('/api/config', (req, res) => {
  res.json({
    shop: config.SHOP,
    systemTime: new Date().toISOString(),
    status: 'online',
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), auth: 'supabase-jwt' });
});

// Protected routes (Supabase Phone Auth JWT required)
app.use('/api/customers', authMiddleware, require('./routes/customers'));
app.use('/api/entries', authMiddleware, require('./routes/entries'));
app.use('/api/payments', authMiddleware, require('./routes/payments'));
app.use('/api/medicines', authMiddleware, require('./routes/medicines'));
app.use('/api/reports', authMiddleware, require('./routes/reports'));
app.use('/api/bills', require('./routes/bills'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Create HTTP server
const server = http.createServer(app);

// Start Server
server.listen(config.PORT, () => {
  console.log(`====================================================`);
  console.log(`  MedTrack — Medical Shop Customer Khata Ledger`);
  console.log(`  API running on http://localhost:${config.PORT}`);
  console.log(`  Database: ${config.DB_PATH}`);
  console.log(`====================================================`);
});
