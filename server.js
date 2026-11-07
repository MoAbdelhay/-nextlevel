/* Mouj studio server — serves the site and the listing-submission API.
   Storage lives in store.js: Supabase when SUPABASE_URL + SUPABASE_SECRET_KEY are set,
   otherwise SQLite (data/listings.db) with photos in uploads/. */

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const multer = require('multer');
const { openStore } = require('./store');
const { validateListing } = require('./lib/listing');

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
app.get(['/listing', '/listing.html'], page('listing.html'));
for (const f of ['seed-listings.json', 'logo.svg', 'logo-mark.svg', 'mouj.js', 'nav.js', 'nav.css', 'ui.css']) app.get('/' + f, page(f));
app.use('/seed', express.static(path.join(PUBLIC_DIR, 'seed'), { maxAge: '7d' }));
if (store.uploadDir) app.use('/uploads', express.static(store.uploadDir, { maxAge: '7d', immutable: true }));

app.get('/healthz', (req, res) => res.json({ ok: true, storage: store.kind }));

app.post('/api/listings', upload.array('photos', 12), async (req, res, next) => {
  try {
    const b = req.body || {};
    const { errors, fields } = validateListing((name) => b[name]);
    if (errors.length) return res.status(400).json({ ok: false, errors });
    const result = await store.createListing(fields, req.files || []);
    res.status(201).json({ ok: true, ...result });
  } catch (e) { next(e); }
});

app.get('/api/listings/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const listing = Number.isInteger(id) && id > 0 ? await store.getListing(id) : null;
    if (!listing) return res.status(404).json({ ok: false, errors: ['Listing not found.'] });
    res.json({ ok: true, listing });
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
