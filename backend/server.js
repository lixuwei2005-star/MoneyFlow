const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-please';
const JWT_EXPIRES = '30d';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ---------- DB ----------
const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    pin_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS data (
    user_id INTEGER PRIMARY KEY,
    payload TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// ---------- Rate limit (in-memory) ----------
const failMap = new Map(); // key -> { count, lockedUntil }
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function checkLock(key) {
  const rec = failMap.get(key);
  if (rec && rec.lockedUntil > Date.now()) {
    return Math.ceil((rec.lockedUntil - Date.now()) / 1000);
  }
  return 0;
}
function recordFail(key) {
  const rec = failMap.get(key) || { count: 0, lockedUntil: 0 };
  rec.count++;
  if (rec.count >= MAX_FAILS) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    rec.count = 0;
  }
  failMap.set(key, rec);
}
function clearFail(key) {
  failMap.delete(key);
}

// ---------- Helpers ----------
function validateCreds(username, pin) {
  if (typeof username !== 'string' || typeof pin !== 'string') return 'invalid input';
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return 'username must be 3-20 chars (letters/digits/_)';
  if (!/^\d{4,6}$/.test(pin)) return 'pin must be 4-6 digits';
  return null;
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

// ---------- Routes ----------
app.post('/register', (req, res) => {
  const { username, pin } = req.body || {};
  const err = validateCreds(username, pin);
  if (err) return res.status(400).json({ error: err });

  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'username taken' });

  const hash = bcrypt.hashSync(pin, 10);
  const info = db.prepare('INSERT INTO users (username, pin_hash, created_at) VALUES (?, ?, ?)')
    .run(username, hash, Date.now());

  const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, username });
});

app.post('/login', (req, res) => {
  const { username, pin } = req.body || {};
  const err = validateCreds(username, pin);
  if (err) return res.status(400).json({ error: err });

  const key = `${username}:${req.ip}`;
  const lockSec = checkLock(key);
  if (lockSec) return res.status(429).json({ error: `locked, retry in ${lockSec}s` });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(pin, user.pin_hash)) {
    recordFail(key);
    return res.status(401).json({ error: 'invalid credentials' });
  }
  clearFail(key);

  const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, username });
});

// Pull cloud data
app.get('/sync', auth, (req, res) => {
  const row = db.prepare('SELECT payload, version, updated_at FROM data WHERE user_id = ?').get(req.user.id);
  if (!row) return res.json({ payload: null, version: 0, updatedAt: 0 });
  res.json({
    payload: JSON.parse(row.payload),
    version: row.version,
    updatedAt: row.updated_at,
  });
});

// Push (with version check)
app.post('/sync', auth, (req, res) => {
  const { payload, version, force } = req.body || {};
  if (payload === undefined || typeof version !== 'number') {
    return res.status(400).json({ error: 'payload and version required' });
  }

  const cur = db.prepare('SELECT version FROM data WHERE user_id = ?').get(req.user.id);
  const curVersion = cur ? cur.version : 0;

  if (!force && version < curVersion) {
    return res.status(409).json({ error: 'version conflict', serverVersion: curVersion });
  }

  const newVersion = Math.max(version, curVersion) + 1;
  const now = Date.now();
  const json = JSON.stringify(payload);

  if (cur) {
    db.prepare('UPDATE data SET payload = ?, version = ?, updated_at = ? WHERE user_id = ?')
      .run(json, newVersion, now, req.user.id);
  } else {
    db.prepare('INSERT INTO data (user_id, payload, version, updated_at) VALUES (?, ?, ?, ?)')
      .run(req.user.id, json, newVersion, now);
  }
  res.json({ version: newVersion, updatedAt: now });
});

app.get('/me', auth, (req, res) => {
  res.json({ username: req.user.username });
});

app.get('/', (_, res) => res.send('moneyflow backend ok'));

app.listen(PORT, () => console.log(`backend listening on :${PORT}`));
