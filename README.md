# MOUJJ — Real Estate Marketing Studio

A one-screen site: a live WebGL ocean that the mouse wheel stirs, the latest listings floating on the water, a listing-submission form with photo upload, and a separate listings page. English and Arabic (right-to-left), prices in Saudi Riyal.

## Put it online for free (Cloudflare + Supabase)

Cloudflare Workers serves the pages and runs the small listings API (free plan, no sleeping). Supabase keeps the listings and photos. The domain moujj.com, HTTPS and email forwarding are all handled in Cloudflare.

### 1. Supabase: database and photo storage

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste everything in [`supabase/setup.sql`](supabase/setup.sql), and press **Run** (safe to run again). Run it again whenever this file changes, to add new columns.
3. Copy the **Project URL** (Project Settings → Data API, like `https://abcd1234.supabase.co`) and the **Secret key** (Project Settings → API Keys, starts with `sb_secret_`; or the legacy `service_role` key). Keep the secret key private.

### 2. Cloudflare Worker: the site

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → connect GitHub → pick `-nextlevel`.
2. Keep the name `mouj`, leave the build command empty, deploy command `npx wrangler deploy`, and deploy. Cloudflare reads [`wrangler.jsonc`](wrangler.jsonc).
3. In the Worker: **Settings → Variables and Secrets → Add**, type **Secret**, twice: `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Then **Deployments → redeploy** (or push any change).
4. Check `https://mouj.<your-subdomain>.workers.dev/healthz` says `"configured":true`. The As-Safa starter listing is added on the first visit.

Every push to `main` redeploys automatically.

### 3. Your domain: moujj.com (registered at IONOS, DNS on Cloudflare)

1. **Name servers:** add `moujj.com` to Cloudflare (Free plan), then in IONOS → Domains & SSL → moujj.com → Name servers, enter Cloudflare's two (turn off DNSSEC at IONOS first if it is on).
2. **Clear old records:** Cloudflare → DNS → Records: delete every `A`, `AAAA` and `CNAME` record named `moujj.com` (`@`) or `www` (the IONOS parking ones, or old ones pointing to Render).
3. **Attach the domain:** Worker → **Settings → Domains & Routes → Add → Custom domain** → `moujj.com`, then again for `www.moujj.com`. Cloudflare creates the DNS records and the HTTPS certificate itself.
4. **HTTPS:** SSL/TLS → Edge Certificates → **Always Use HTTPS** on.
5. **Email:** Cloudflare → Email → **Email Routing** → enable (it adds the MX/SPF records; delete old IONOS MX records), verify your inbox under Destination addresses, then create `info@moujj.com` → that inbox. Replies go out from the inbox's own address.

**Free-plan limits:** Workers free allows 100,000 requests a day. Supabase pauses a free project after a week with no activity; un-pause it from the Supabase dashboard.

## Running on your computer

Requires **Node.js 22.5+**.

```
npm install
npm start
```

Then open http://localhost:3000 (or `npm run cf:dev` to run the Cloudflare Worker locally, with secrets in a `.dev.vars` file). Without the Supabase settings it stores listings in `data/listings.db` (SQLite) and photos in `uploads/`. To use Supabase locally, start it with `SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm start`.

## Files

- `public/index.html`: the ocean page, form and floating listings
- `public/listings.html`: all listings, with search, filters (sale/rent, type, beds, price) and a map view
- `public/listing.html`: one listing: photo gallery, key facts, WhatsApp / call / share, description and map
- `public/mouj.js`: helpers shared by the pages
- `lib/listing.js`: checks submitted listings (used by both servers)
- `public/seed-listings.json` and `public/seed/`: starter listings and their photos
- `worker/index.js` + `wrangler.jsonc`: the Cloudflare Worker (listings API) and its settings
- `server.js` + `store.js`: Node server for running on your own computer (SQLite) or any Node host
- `supabase/setup.sql`: one-time Supabase setup
- `render.yaml`: old Render settings, only needed while the Render service still exists

## Videos (Remotion)

`video/` is a separate [Remotion](https://www.remotion.dev) project for making brand videos in code; it is not part of the website deploy.

```
cd video
npm install
npm run studio     # live editor in the browser
npm run render     # writes out/mouj-intro.mp4
```

Starter composition: `MoujIntro` (5 s, 1920×1080), the logo rising over moving waves. Remotion's licence is free for individuals and companies of up to 3 people; larger companies need a company licence.
