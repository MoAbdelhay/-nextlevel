/* Mouj on Cloudflare Workers.
   Static pages and images come from public/ (Workers static assets).
   This script only handles the listings API and /healthz; data lives in Supabase
   (secrets SUPABASE_URL and SUPABASE_SECRET_KEY). */
import { createClient } from '@supabase/supabase-js';
import { validateListing } from '../lib/listing.js';

const BUCKET = 'photos';
const MAX_PHOTOS = 12;
const MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
const makeRef = (id) => 'LST 2026/' + String(130 + id).padStart(3, '0');

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function client(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new Error('Supabase is not configured (SUPABASE_URL / SUPABASE_SECRET_KEY).');
  return createClient(env.SUPABASE_URL.replace(/\/+$/, ''), env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function insertListing(sb, fields) {
  const { data, error } = await sb.from('listings').insert(fields).select('id').single();
  if (error) throw new Error('Database: ' + error.message);
  const ref = makeRef(data.id);
  const up = await sb.from('listings').update({ ref }).eq('id', data.id);
  if (up.error) throw new Error('Database: ' + up.error.message);
  return { id: data.id, ref };
}

async function addPhoto(sb, listingId, bytes, original, type) {
  const name = listingId + '/' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + (EXT[type] || '.jpg');
  const { error } = await sb.storage.from(BUCKET).upload(name, bytes, { contentType: type, upsert: false });
  if (error) throw new Error('Photo upload: ' + error.message);
  const ins = await sb.from('photos').insert({ listing_id: listingId, filename: name, original });
  if (ins.error) throw new Error('Database: ' + ins.error.message);
}

/* starter listings from public/seed-listings.json: added once per database, checked once per Worker instance */
let seeded = null;
function seedOnce(sb, env, origin) {
  seeded ??= (async () => {
    const res = await env.ASSETS.fetch(new Request(origin + '/seed-listings.json'));
    if (!res.ok) return;
    for (const l of await res.json()) {
      const found = await sb.from('listings').select('id, photos(id)').eq('title', l.title).eq('city', l.city).limit(1);
      if (found.error) throw new Error('Database: ' + found.error.message);
      let id = found.data[0]?.id;
      const hasPhotos = (found.data[0]?.photos || []).length > 0;
      if (!id) id = (await insertListing(sb, {
        title: l.title, address: l.address || '', city: l.city, price: l.price, type: l.type || '',
        beds: l.beds ?? null, baths: l.baths ?? null, area_m2: l.area_m2 ?? null, district: l.district || null,
        furnished: l.furnished ?? null, lat: l.lat ?? null, lng: l.lng ?? null,
        description: l.description || '', agent_name: '', agent_email: l.agent_email || '', agent_phone: l.agent_phone || null,
        purpose: l.purpose === 'rent' ? 'rent' : 'sale',
      })).id;
      if (!hasPhotos) for (const rel of l.photos || []) {
        const img = await env.ASSETS.fetch(new Request(origin + '/' + rel.replace(/^\/+/, '')));
        if (img.ok) await addPhoto(sb, id, await img.arrayBuffer(), rel.split('/').pop(), img.headers.get('content-type') || 'image/jpeg');
      }
    }
  })().catch((e) => { seeded = null; console.warn('Starter listings:', e.message); });
  return seeded;
}

async function listListings(sb) {
  const { data, error } = await sb.from('listings')
    .select('*, photos(filename, original, id)')
    .order('id', { ascending: false }).limit(60);
  if (error) throw new Error('Database: ' + error.message);
  return data.map((l) => withUrls(sb, l));
}

function withUrls(sb, l) {
  const publicUrl = (p) => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
  return {
    ...l,
    photos: (l.photos || []).sort((a, b) => a.id - b.id).map((p) => ({ url: publicUrl(p.filename), original: p.original })),
  };
}

async function getListing(sb, id) {
  const { data, error } = await sb.from('listings').select('*, photos(filename, original, id)').eq('id', id).maybeSingle();
  if (error) throw new Error('Database: ' + error.message);
  return data ? withUrls(sb, data) : null;
}

async function createListing(sb, request) {
  let form;
  try { form = await request.formData(); } catch { return json({ ok: false, errors: ['Could not read the form.'] }, 400); }
  const files = form.getAll('photos').filter((f) => typeof f === 'object' && f && f.size > 0);
  const { errors, fields } = validateListing((name) => form.get(name));
  if (files.length > MAX_PHOTOS) errors.push('Twelve photos is the limit.');
  if (files.some((f) => !IMAGE_TYPES.test(f.type))) errors.push('Photos must be JPEG, PNG, WebP, GIF or AVIF.');
  if (files.some((f) => f.size > MAX_BYTES)) errors.push('Each photo must be 8 MB or smaller.');
  if (errors.length) return json({ ok: false, errors }, 400);

  const { id, ref } = await insertListing(sb, fields);
  for (const f of files) await addPhoto(sb, id, await f.arrayBuffer(), String(f.name || '').slice(0, 200), f.type);
  return json({ ok: true, id, ref, photos: files.length }, 201);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/healthz') return json({ ok: true, storage: 'supabase', configured: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) });
      if (url.pathname === '/api/listings') {
        const sb = client(env);
        if (request.method === 'GET') {
          await seedOnce(sb, env, url.origin);
          return json({ ok: true, listings: await listListings(sb) });
        }
        if (request.method === 'POST') {
          ctx.waitUntil(seedOnce(sb, env, url.origin));
          return await createListing(sb, request);
        }
        return json({ ok: false, errors: ['Method not allowed.'] }, 405);
      }
      const one = url.pathname.match(/^\/api\/listings\/(\d+)$/);
      if (one && request.method === 'GET') {
        const sb = client(env);
        await seedOnce(sb, env, url.origin);
        const listing = await getListing(sb, Number(one[1]));
        return listing ? json({ ok: true, listing }) : json({ ok: false, errors: ['Listing not found.'] }, 404);
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      console.error(e);
      return json({ ok: false, errors: [e.message || 'Something went wrong.'] }, 500);
    }
  },
};
