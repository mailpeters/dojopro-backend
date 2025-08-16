


const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

router.post('/signup-owner', async (req, res) => {
  const { email, password, clubName, subdomain } = req.body || {};
  if (!email || !password || !clubName || !subdomain)
    return res.status(400).json({ error: 'missing_fields' });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'invalid_email' });

  if (!/^[a-z0-9-]{3,63}$/.test(subdomain))
    return res.status(400).json({ error: 'invalid_subdomain' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // dup checks
    const [u0] = await conn.query('SELECT 1 FROM users WHERE email=?', [email]);
    if (u0.length) { await conn.rollback(); return res.status(409).json({ error: 'email_exists' }); }

    const [c0] = await conn.query('SELECT 1 FROM clubs WHERE subdomain=?', [subdomain]);
    if (c0.length) { await conn.rollback(); return res.status(409).json({ error: 'subdomain_exists' }); }

    // create user
    const hash = await bcrypt.hash(password, 10);
    const [u] = await conn.query(
      'INSERT INTO users (email,password_hash,first_name,last_name) VALUES (?,?,?,?)',
      [email, hash, '', '']
    );
    const userId = u.insertId;

    // create club
    const [c] = await conn.query(
      'INSERT INTO clubs (club_name, subdomain) VALUES (?,?)',
      [clubName, subdomain]
    );
    const clubId = c.insertId;

    // link owner
    await conn.query(
      "INSERT INTO club_staff (club_id,user_id,role,is_primary_contact) VALUES (?,?, 'owner', 1)",
      [clubId, userId]
    );

    // defaults
    await conn.query(
      "INSERT INTO club_settings (club_id, logo_url, primary_color, secondary_color) VALUES (?, NULL, '#0F172A', '#38BDF8')",
      [clubId]
    );

    await conn.commit();

    const token = jwt.sign(
      { sub: String(userId), email, club_id: clubId, subdomain, roles: ['owner'] },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    return res.status(201).json({ token, clubId, subdomain });
  } catch (e) {
    await conn.rollback();
    if (e && e.code === 'ER_DUP_ENTRY') {
      const msg = /uq_users_email/i.test(e.sqlMessage || '') ? 'email_exists'
                : /uq_clubs_subdomain/i.test(e.sqlMessage || '') ? 'subdomain_exists'
                : 'dup_entry';
      return res.status(409).json({ error: msg });
    }
    console.error(e);
    return res.status(500).json({ error: 'signup_failed' });
  } finally {
    conn.release();
  }
});

module.exports = router;

