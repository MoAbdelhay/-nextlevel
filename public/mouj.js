/* Shared helpers for the MOUJJ pages: loading listings, prices, labels and contact links. */
(() => {
  const NUM = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

  const TYPES = {
    villa:      { en: 'Villa',      ar: 'فيلا' },
    apartment:  { en: 'Apartment',  ar: 'شقة' },
    floor:      { en: 'Floor',      ar: 'دور' },
    townhouse:  { en: 'Townhouse',  ar: 'تاون هاوس' },
    land:       { en: 'Land',       ar: 'أرض' },
    building:   { en: 'Building',   ar: 'عمارة' },
    commercial: { en: 'Commercial', ar: 'تجاري' },
  };

  const WORDS = {
    en: { bed: n => n + (n === 1 ? ' bed' : ' beds'), bath: n => n + (n === 1 ? ' bath' : ' baths'),
          m2: n => NUM.format(n) + ' m²', furnished: 'Furnished', unfurnished: 'Unfurnished',
          perYear: ' / year', sale: 'For sale', rent: 'For rent' },
    ar: { bed: n => n + ' غرف', bath: n => n + ' حمّام', m2: n => NUM.format(n) + ' م²',
          furnished: 'مفروش', unfurnished: 'غير مفروش', perYear: ' / سنويًا', sale: 'للبيع', rent: 'للإيجار' },
  };

  /* listings from the server; on a static host fall back to the starter listings file */
  function fromSeed(list) {
    return list.map((l, i) => ({
      id: i + 1, ref: null, title: l.title, address: l.address || '', city: l.city, price: l.price,
      purpose: l.purpose === 'rent' ? 'rent' : 'sale', type: l.type || '', beds: l.beds ?? null, baths: l.baths ?? null,
      area_m2: l.area_m2 ?? null, district: l.district || null, furnished: l.furnished ?? null,
      description: l.description || '', lat: l.lat ?? null, lng: l.lng ?? null,
      agent_email: l.agent_email || '', agent_phone: l.agent_phone || null,
      photos: (l.photos || []).map(p => ({ url: p })),
    }));
  }
  async function apiJson(url) {
    const res = await fetch(url);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) return null;              /* static host: no API */
    return { status: res.status, body: await res.json() };
  }
  async function fetchListings() {
    try {
      const r = await apiJson('api/listings');
      if (r && r.status === 200) return r.body.listings || [];
    } catch {}
    const res = await fetch('seed-listings.json');
    if (!res.ok) throw new Error('no listings');
    return fromSeed(await res.json());
  }
  async function fetchListing(id) {
    try {
      const r = await apiJson('api/listings/' + encodeURIComponent(id));
      if (r) return r.status === 200 ? r.body.listing : null;
    } catch {}
    const all = fromSeed(await (await fetch('seed-listings.json')).json());
    return all.find(l => String(l.id) === String(id)) || null;
  }

  /* price with the Saudi Riyal sign (needs <symbol id="riyal"> on the page) */
  function priceEl(value, suffix) {
    const span = document.createElement('span');
    span.className = 'price'; span.dir = 'ltr';
    span.innerHTML = '<svg class="riyal" role="img" aria-label="SAR"><use href="#riyal"/></svg>';
    span.append(NUM.format(value));
    if (suffix) { const sm = document.createElement('small'); sm.textContent = suffix; span.append(sm); }
    return span;
  }

  const typeLabel = (type, lang) => (TYPES[type] ? TYPES[type][lang] : '');

  /* short facts like "Villa · 4 beds · 3 baths · 450 m²" */
  function facts(l, lang) {
    const W = WORDS[lang] || WORDS.en, out = [];
    const t = typeLabel(l.type, lang); if (t) out.push(t);
    if (l.beds != null) out.push(W.bed(l.beds));
    if (l.baths != null) out.push(W.bath(l.baths));
    if (l.area_m2) out.push(W.m2(l.area_m2));
    if (l.furnished != null) out.push(l.furnished ? W.furnished : W.unfurnished);
    return out;
  }

  const place = l => [l.district, l.city].filter(Boolean).join(', ');

  /* phone links; Saudi numbers like 05XXXXXXXX become +9665XXXXXXXX */
  function intlDigits(phone) {
    let d = String(phone || '').replace(/[^\d+]/g, '');
    if (d.startsWith('+')) return d.slice(1);
    if (d.startsWith('00')) return d.slice(2);
    if (/^05\d{8}$/.test(d)) return '966' + d.slice(1);
    if (/^5\d{8}$/.test(d)) return '966' + d;
    return d;
  }
  const telLink = phone => phone ? 'tel:+' + intlDigits(phone) : '';
  function waLink(phone, text) {
    const d = intlDigits(phone);
    return d.length >= 8 ? 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '') : '';
  }

  const listingUrl = l => 'listing.html?id=' + encodeURIComponent(l.id);

  window.Moujj = { TYPES, WORDS, fetchListings, fetchListing, priceEl, typeLabel, facts, place, telLink, waLink, listingUrl };
})();
