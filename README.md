# MOUJ — Real Estate Marketing Studio

A one-screen site: a live WebGL ocean that the mouse wheel stirs, the latest listings floating on the water, a listing-submission form with photo upload, and a separate listings page. English and Arabic (right-to-left), prices in Saudi Riyal.

## Put it online for free (Render + Supabase)

Render runs the server. Supabase keeps the listings and photos, because Render's free plan wipes its own disk whenever the server restarts.

### 1. Supabase: database and photo storage (about 3 minutes)

1. Sign up at [supabase.com](https://supabase.com) and create a **New project** (any name, e.g. `mouj`; pick a region close to your visitors and save the database password somewhere).
2. When the project is ready, open **SQL Editor → New query**, paste everything in [`supabase/setup.sql`](supabase/setup.sql), and press **Run**. This creates the `listings` and `photos` tables and a public `photos` storage bucket.
3. Copy two values for Render:
   - **Project URL**: Project Settings → Data API (looks like `https://abcd1234.supabase.co`).
   - **Secret key**: Project Settings → API Keys → *Secret keys* (starts with `sb_secret_`). If you only see legacy keys, use the `service_role` key instead.
   Keep the secret key private: it can read and change everything in the project.

### 2. Render: the server (about 3 minutes)

1. Sign up at [render.com](https://render.com) with your GitHub account and allow it to see the `-nextlevel` repository.
2. Click **New → Blueprint**, pick the repository, and Render reads [`render.yaml`](render.yaml).
3. When asked, paste `SUPABASE_URL` (Project URL) and `SUPABASE_SECRET_KEY` (secret key), then **Apply**.
4. After the first deploy finishes, your site is at the `onrender.com` address Render shows (for example `https://mouj.onrender.com`). Opening `/healthz` there should say `"storage":"supabase"`.

Every push to `main` redeploys automatically. The As-Safa starter listing (from `seed-listings.json`) is added to Supabase on the first start.

**Free-plan limits:** after 15 minutes without visitors the Render server sleeps, and the next visit takes about a minute to wake it. Supabase pauses a free project after a week with no activity; un-pause it from the Supabase dashboard.

## Running on your computer

Requires **Node.js 22.5+**.

```
npm install
npm start
```

Then open http://localhost:3000. Without the Supabase settings it stores listings in `data/listings.db` (SQLite) and photos in `uploads/`. To use Supabase locally, start it with `SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm start`.

## Files

- `index.html`: the ocean page, form and floating listings
- `listings.html`: all listings, with search, sale/rent filter and sort
- `server.js`: web server and listings API
- `store.js`: storage (Supabase, or SQLite for local use)
- `seed-listings.json` and `seed/`: starter listings and their photos
- `supabase/setup.sql`: one-time Supabase setup
- `render.yaml`: Render deployment settings
