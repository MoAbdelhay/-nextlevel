/* NextLevel studio server — serves the site and the listing-submission API.
   Storage: SQLite via node:sqlite (data/listings.db), photos on disk in uploads/. */

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const multer = require('multer');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------- database ---------- */
const db = new DatabaseSync(path.join(DATA_DIR, 'listings.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS listings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ref         TEXT,
    title       TEXT NOT NULL,
    address     TEXT NOT NULL,
    city        TEXT NOT NULL,
    price       INTEGER NOT NULL,
    type        TEXT NOT NULL DEFAULT 'house',
    beds        INTEGER,
    baths       REAL,
    sqft        INTEGER,
    description TEXT,
    agent_name  TEXT NOT NULL,
    agent_email TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS photos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    filename   TEXT NOT NULL,
    original   TEXT
  );
`);
/* older databases: add the sale/rent column if it is missing */
if (!db.prepare('PRAGMA table_info(listings)').all().some((c) => c.name === 'purpose')) {
  db.exec("ALTER TABLE listings ADD COLUMN purpose TEXT NOT NULL DEFAULT 'sale'");
}

/* ---------- photo uploads ---------- */
const EXT_OK = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + (EXT_OK.has(ext) ? ext : '.jpg'));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Photos must be JPEG, PNG, WebP, GIF or AVIF.'), ok);
  },
});

/* ---------- app ---------- */
const app = express();
app.use(express.static(ROOT, { extensions: ['html'] }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));

const insListing = db.prepare(`
  INSERT INTO listings (title, address, city, price, type, beds, baths, sqft, description, agent_name, agent_email, purpose)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const setRef = db.prepare('UPDATE listings SET ref = ? WHERE id = ?');
const insPhoto = db.prepare('INSERT INTO photos (listing_id, filename, original) VALUES (?, ?, ?)');
const recentListings = db.prepare('SELECT * FROM listings ORDER BY id DESC LIMIT 60');
const photosFor = db.prepare('SELECT filename, original FROM photos WHERE listing_id = ? ORDER BY id');

app.post('/api/listings', upload.array('photos', 12), (req, res) => {
  const b = req.body || {};
  const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);

  const title = clean(b.title, 140);
  const address = clean(b.address, 200);
  const city = clean(b.city, 120);
  const agentName = clean(b.agent_name, 120);
  const agentEmail = clean(b.agent_email, 200);
  const price = Math.round(Number(b.price));
  const purpose = clean(b.purpose, 10);

  const errors = [];
  if (!title) errors.push('Property title is required.');
  if (!city) errors.push('Location is required.');
  if (purpose !== 'sale' && purpose !== 'rent') errors.push('Choose Sale or Rent.');
  if (!Number.isFinite(price) || price <= 0) errors.push('Asking price must be a positive number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agentEmail)) errors.push('A valid contact email is required.');
  if (errors.length) {
    for (const f of req.files || []) fs.unlink(f.path, () => {});
    return res.status(400).json({ ok: false, errors });
  }

  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
  const TYPES = new Set(['house', 'condo', 'townhouse', 'land', 'multi-family', 'commercial']);
  const type = TYPES.has(clean(b.type, 40)) ? clean(b.type, 40) : 'house';

  const info = insListing.run(
    title, address, city, price, type,
    num(b.beds), num(b.baths), num(b.sqft),
    clean(b.description, 4000), agentName, agentEmail, purpose
  );
  const id = Number(info.lastInsertRowid);
  const ref = 'LST 2026/' + String(130 + id).padStart(3, '0');
  setRef.run(ref, id);
  for (const f of req.files || []) insPhoto.run(id, f.filename, clean(f.originalname, 200));

  res.status(201).json({ ok: true, id, ref, photos: (req.files || []).length });
});

app.get('/api/listings', (req, res) => {
  const rows = recentListings.all().map((l) => ({
    ...l,
    photos: photosFor.all(l.id).map((p) => ({ url: '/uploads/' + p.filename, original: p.original })),
  }));
  res.json({ ok: true, listings: rows });
});

/* multer / upload errors as JSON */
app.use((err, req, res, next) => {
  const msg = err instanceof multer.MulterError
    ? (err.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be 8 MB or smaller.' : err.message)
    : err.message || 'Upload failed.';
  res.status(400).json({ ok: false, errors: [msg] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NextLevel studio server — http://localhost:${PORT}`);
  console.log(`Database: ${path.join(DATA_DIR, 'listings.db')}`);
});
