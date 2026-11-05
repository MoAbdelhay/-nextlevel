/* Where listings and photos are kept.
   - With SUPABASE_URL + SUPABASE_SECRET_KEY set (e.g. on Render): Supabase database + Storage bucket "photos".
   - Otherwise (local development): SQLite in data/listings.db and photo files in uploads/.
   Both expose the same three functions: createListing, listListings, seed. */

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const ROOT = __dirname;
const BUCKET = 'photos';
const makeRef = (id) => 'LST 2026/' + String(130 + id).padStart(3, '0');
const photoName = (original) => {
  const ext = path.extname(original || '').toLowerCase();
  const ok = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(ext);
  return Date.now() + '-' + crypto.randomBytes(4).toString('hex') + (ok ? ext : '.jpg');
};
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif' };

/* =============================== Supabase =============================== */
function supabaseStore(url, key) {
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const publicUrl = (p) => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

  async function insertListing(fields) {
    const { data, error } = await sb.from('listings').insert(fields).select('id').single();
    if (error) throw new Error('Database: ' + error.message);
    const ref = makeRef(data.id);
    const up = await sb.from('listings').update({ ref }).eq('id', data.id);
    if (up.error) throw new Error('Database: ' + up.error.message);
    return { id: data.id, ref };
  }
  async function addPhoto(listingId, buffer, original, mimetype) {
    const name = listingId + '/' + photoName(original);
    const { error } = await sb.storage.from(BUCKET).upload(name, buffer, { contentType: mimetype, upsert: false });
    if (error) throw new Error('Photo upload: ' + error.message);
    const ins = await sb.from('photos').insert({ listing_id: listingId, filename: name, original });
    if (ins.error) throw new Error('Database: ' + ins.error.message);
  }

  return {
    kind: 'supabase',
    async createListing(fields, files) {
      const { id, ref } = await insertListing(fields);
      for (const f of files) await addPhoto(id, f.buffer, f.originalname, f.mimetype);
      return { id, ref, photos: files.length };
    },
    async listListings() {
      const { data, error } = await sb.from('listings')
        .select('*, photos(filename, original, id)')
        .order('id', { ascending: false }).limit(60);
      if (error) throw new Error('Database: ' + error.message);
      return data.map((l) => ({
        ...l,
        photos: (l.photos || []).sort((a, b) => a.id - b.id)
          .map((p) => ({ url: publicUrl(p.filename), original: p.original })),
      }));
    },
    async seed(seeds) {
      for (const l of seeds) {
        const found = await sb.from('listings').select('id, photos(id)').eq('title', l.title).eq('city', l.city).limit(1);
        if (found.error) throw new Error('Database: ' + found.error.message);
        let id = found.data[0]?.id;
        const hasPhotos = (found.data[0]?.photos || []).length > 0;
        if (!id) id = (await insertListing(seedFields(l))).id;
        if (l.photos?.length && !hasPhotos) {
          for (const rel of l.photos) {
            const src = path.join(ROOT, rel);
            if (!fs.existsSync(src)) continue;
            await addPhoto(id, fs.readFileSync(src), path.basename(rel), MIME[path.extname(rel).toLowerCase()] || 'image/jpeg');
          }
        }
      }
    },
    where: url,
  };
}

/* ================================ SQLite ================================ */
function sqliteStore() {
  const { DatabaseSync } = require('node:sqlite');
  const DATA_DIR = path.join(ROOT, 'data');
  const UPLOAD_DIR = path.join(ROOT, 'uploads');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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

  const insListing = db.prepare(`
    INSERT INTO listings (title, address, city, price, type, beds, baths, sqft, description, agent_name, agent_email, purpose)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const setRef = db.prepare('UPDATE listings SET ref = ? WHERE id = ?');
  const insPhoto = db.prepare('INSERT INTO photos (listing_id, filename, original) VALUES (?, ?, ?)');
  const recent = db.prepare('SELECT * FROM listings ORDER BY id DESC LIMIT 60');
  const photosFor = db.prepare('SELECT filename, original FROM photos WHERE listing_id = ? ORDER BY id');
  const exists = db.prepare('SELECT id FROM listings WHERE title = ? AND city = ?');
  const photoCount = db.prepare('SELECT COUNT(*) AS n FROM photos WHERE listing_id = ?');

  function insert(f) {
    const info = insListing.run(f.title, f.address, f.city, f.price, f.type, f.beds, f.baths, f.sqft,
      f.description, f.agent_name, f.agent_email, f.purpose);
    const id = Number(info.lastInsertRowid);
    const ref = makeRef(id);
    setRef.run(ref, id);
    return { id, ref };
  }
  function savePhoto(id, buffer, original) {
    const name = photoName(original);
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
    insPhoto.run(id, name, original);
  }

  return {
    kind: 'sqlite',
    uploadDir: UPLOAD_DIR,
    async createListing(fields, files) {
      const { id, ref } = insert(fields);
      for (const f of files) savePhoto(id, f.buffer, f.originalname);
      return { id, ref, photos: files.length };
    },
    async listListings() {
      return recent.all().map((l) => ({
        ...l,
        photos: photosFor.all(l.id).map((p) => ({ url: '/uploads/' + p.filename, original: p.original })),
      }));
    },
    async seed(seeds) {
      for (const l of seeds) {
        let id = exists.get(l.title, l.city)?.id;
        if (!id) id = insert(seedFields(l)).id;
        if (l.photos?.length && photoCount.get(id).n === 0) {
          for (const rel of l.photos) {
            const src = path.join(ROOT, rel);
            if (fs.existsSync(src)) savePhoto(id, fs.readFileSync(src), path.basename(rel));
          }
        }
      }
    },
    where: path.join(DATA_DIR, 'listings.db'),
  };
}

function seedFields(l) {
  return {
    title: l.title, address: l.address || '', city: l.city, price: l.price, type: 'house',
    beds: null, baths: null, sqft: null, description: '', agent_name: '', agent_email: l.agent_email,
    purpose: l.purpose === 'rent' ? 'rent' : 'sale',
  };
}

function openStore() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return supabaseStore(url.replace(/\/+$/, ''), key);
  if (url || key) console.warn('Supabase needs both SUPABASE_URL and SUPABASE_SECRET_KEY; using local SQLite instead.');
  return sqliteStore();
}

module.exports = { openStore };
