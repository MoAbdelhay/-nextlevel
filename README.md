# MOUJ — Real Estate Marketing Studio

A single-page marketing site with a live WebGL ocean hero, a bilingual (English / العربية) interface with RTL support, and a listing-submission form backed by a real SQLite database.

## Features

- **WebGL sea hero** — Gerstner-wave ocean rendered with Three.js, rising and falling on a harmonic "market tide" model, with a live buyer-demand index and a ±12-month market scrubber.
- **Listing submissions** — § 1 form with location fields and drag-and-drop photo upload (up to 12 photos, 8 MB each), filed to a SQLite database with a reference number. A "latest filings" register renders live from the database.
- **Arabic / English toggle** — full translation of static and dynamic content, RTL layout, Arabic font pairing (IBM Plex Sans Arabic + Noto Naskh Arabic), persisted in localStorage.
- Services grid, interactive market-cycle dial, notices, inline SVG skyline art bands, and scroll reveals — all in one self-contained page.

## Running

Requires **Node.js 22.5+** (uses the built-in `node:sqlite` module).

