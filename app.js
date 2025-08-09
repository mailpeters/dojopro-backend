require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

/**
 * POST /api/owner/signup
 * Body: { clubName, locationName, locationAddress, ownerEmail, ownerPasswordHash }
 * NOTE: For now we accept a password hash value; later we’ll salt/hash in backend.
 */
app.post('/api/owner/signup', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { clubName, locationName, locationAddress, ownerEmail, ownerPasswordHash } = req.body;
    if (!clubName || !ownerEmail || !ownerPasswordHash) {
      return res.status(400).json({ error: 'clubName, ownerEmail, ownerPasswordHash are required' });
    }

    await conn.beginTransaction();

    // 1) Create club
    const [clubResult] = await conn.execute(
      'INSERT INTO clubs (name, address) VALUES (?, ?)',
      [clubName, null]
    );
    const clubId = clubResult.insertId;

    // 2) Create first location
    const [locResult] = await conn.execute(
      'INSERT INTO locations (club_id, name, address) VALUES (?, ?, ?)',
      [clubId, locationName || 'Main', locationAddress || null]
    );
    const locationId = locResult.insertId;

    // 3) Ensure "owner" role exists & get id
    const [roleRows] = await conn.execute('SELECT id FROM roles WHERE name = ?', ['owner']);
    let ownerRoleId;
    if (roleRows.length === 0) {
      const [roleInsert] = await conn.execute('INSERT INTO roles (name) VALUES (?)', ['owner']);
      ownerRoleId = roleInsert.insertId;
    } else {
      ownerRoleId = roleRows[0].id;
    }

    // 4) Create user
    const [userResult] = await conn.execute(
      'INSERT INTO users (email, password_hash, club_id, role) VALUES (?, ?, ?, ?)',
      [ownerEmail, ownerPasswordHash, clubId, 'owner'] // role column exists in schema (redundant but simple)
    );
    const userId = userResult.insertId;

    // 5) Map user to owner role (normalized)
    await conn.execute(
      'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userId, ownerRoleId]
    );

    await conn.commit();
    res.json({ clubId, locationId, userId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'signup failed' });
  } finally {
    conn.release();
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 3000, () => {
  console.log(`API listening on ${process.env.PORT || 3000}`);
});

