/* Mouj studio server — serves the site and the listing-submission API.
   Storage lives in store.js: Supabase when SUPABASE_URL + SUPABASE_SECRET_KEY are set,
   otherwise SQLite (data/listings.db) with photos in uploads/. */

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const multer = require('multer');
const { openStore } = require('./store');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');   /* the site's pages and images */
const store = openStore();

/* ---------- photo uploads (kept in memory, then handed to the store) ---------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Photos must be JPEG, PNG, WebP, GIF or AVIF.'), ok);
  },
});

/* ---------- app ---------- */
const app = express();
/* only the public site files are served, never server code or data */
const page = (file) => (req, res) => res.sendFile(path.join(PUBLIC_DIR, file));
app.get(['/', '/index.html'], page('index.html'));
app.get(['/listings', '/listings.html'], page('listings.html'));
for (const f of ['seed-listings.json', 'logo.svg', 'logo-mark.svg']) app.get('/' + f, page(f));
app.use('/seed', express.static(path.join(PUBLIC_DIR, 'seed'), { maxAge: '7d' }));
if (store.uploadDir) app.use('/uploads', express.static(store.uploadDir, { maxAge: '7d', immutable: true }));

app.get('/healthz', (req, res) => res.json({ ok: true, storage: store.kind }));

app.post('/api/listings', upload.array('photos', 12), async (req, res, next) => {
  try {
    const b = req.body || {};
    const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);

    const title = clean(b.title, 140);
    const city = clean(b.city, 120);
    const agentPhone = clean(b.agent_phone, 20);
    const price = Math.round(Number(b.price));
    const purpose = clean(b.purpose, 10);

    const errors = [];
    if (!title) errors.push('Property title is required.');
    if (!city) errors.push('Location is required.');
    if (purpose !== 'sale' && purpose !== 'rent') errors.push('Choose Sale or Rent.');
    if (!Number.isFinite(price) || price <= 0) errors.push('Asking price must be a positive number.');
    if (!/^\+?[0-9 ()-]{7,20}$/.test(agentPhone) || agentPhone.replace(/\D/g, '').length < 7) errors.push('A valid contact phone number is required.');
    if (errors.length) return res.status(400).json({ ok: false, errors });

    const num = (v) => { const n = Number(v); return v !== '' && v != null && Number.isFinite(n) && n >= 0 ? n : null; };
    const TYPES = new Set(['house', 'condo', 'townhouse', 'land', 'multi-family', 'commercial']);
    const type = TYPES.has(clean(b.type, 40)) ? clean(b.type, 40) : 'house';

    const result = await store.createListing({
      title, address: clean(b.address, 200), city, price, type,
      beds: num(b.beds), baths: num(b.baths), sqft: num(b.sqft),
      description: clean(b.description, 4000), agent_name: clean(b.agent_name, 120),
      agent_email: '', agent_phone: agentPhone, purpose,
    }, req.files || []);
    res.status(201).json({ ok: true, ...result });
  } catch (e) { next(e); }
});

app.get('/api/listings', async (req, res, next) => {
  try { res.json({ ok: true, listings: await store.listListings() }); }
  catch (e) { next(e); }
});

app.use((req, res) => res.status(404).send('Not found'));

/* errors as JSON */
app.use((err, req, res, next) => {
  const upload = err instanceof multer.MulterError;
  const msg = upload
    ? (err.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be 8 MB or smaller.' : err.message)
    : err.message || 'Something went wrong.';
  if (!upload) console.error(err);
  res.status(upload || /^Photos must/.test(msg) ? 400 : 500).json({ ok: false, errors: [msg] });
});

/* starter listings (seed-listings.json) are added once, then the server starts */
(async () => {
  try {
    const seeds = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'seed-listings.json'), 'utf8'));
    await store.seed(seeds);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('Could not add starter listings:', e.message);
  }
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Mouj studio server — http://localhost:${PORT}`);
    console.log(`Storage: ${store.kind} (${store.where})`);
  });
})();
