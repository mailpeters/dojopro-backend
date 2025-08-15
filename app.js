const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

async function db() {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });
}
let pool;
(async () => { pool = await db(); })().catch(err => {
  console.error('DB init error:', err);
  process.exit(1);
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/health/db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ db: 'ok', rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ db: 'error', message: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[DojoPro] API listening on ${PORT}`);
});

// List tables in dojopro with row counts
app.get('/meta/tables', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.TABLE_NAME AS tableName,
             COALESCE(s.TABLE_ROWS, 0) AS approxRows
      FROM information_schema.TABLES t
      LEFT JOIN information_schema.TABLES s
        ON s.TABLE_SCHEMA=t.TABLE_SCHEMA AND s.TABLE_NAME=t.TABLE_NAME
      WHERE t.TABLE_SCHEMA = ?
      ORDER BY t.TABLE_NAME
    `, [process.env.DB_NAME]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
