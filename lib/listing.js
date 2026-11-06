/* Checks a submitted listing and turns it into database fields.
   Shared by server.js (Node) and worker/index.js (Cloudflare).
   `get(name)` returns the raw form value for a field name. */

const TYPES = ['villa', 'apartment', 'floor', 'townhouse', 'land', 'building', 'commercial'];

function validateListing(get) {
  const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
  const opt = (name, { min, max, int = true }) => {
    const raw = clean(get(name), 20);
    if (raw === '') return { value: null, ok: true };
    const n = Number(raw);
    const ok = Number.isFinite(n) && n >= min && n <= max && (!int || Number.isInteger(n));
    return { value: ok ? n : null, ok };
  };

  const title = clean(get('title'), 140);
  const city = clean(get('city'), 120);
  const phone = clean(get('agent_phone'), 20);
  const price = Math.round(Number(get('price')));
  const purpose = clean(get('purpose'), 10);
  const type = clean(get('type'), 20);
  const furnishedRaw = clean(get('furnished'), 5);

  const beds = opt('beds', { min: 0, max: 30 });
  const baths = opt('baths', { min: 0, max: 30 });
  const area = opt('area_m2', { min: 1, max: 1000000 });
  const lat = opt('lat', { min: -90, max: 90, int: false });
  const lng = opt('lng', { min: -180, max: 180, int: false });

  const errors = [];
  if (!title) errors.push('Property title is required.');
  if (!city) errors.push('Location is required.');
  if (purpose !== 'sale' && purpose !== 'rent') errors.push('Choose Sale or Rent.');
  if (!Number.isFinite(price) || price <= 0) errors.push('Asking price must be a positive number.');
  if (!/^\+?[0-9 ()-]{7,20}$/.test(phone) || phone.replace(/\D/g, '').length < 7) errors.push('A valid contact phone number is required.');
  if (type && !TYPES.includes(type)) errors.push('Unknown property type.');
  if (!beds.ok) errors.push('Bedrooms must be a whole number from 0 to 30.');
  if (!baths.ok) errors.push('Bathrooms must be a whole number from 0 to 30.');
  if (!area.ok) errors.push('Area must be a whole number of square metres.');
  if (!lat.ok || !lng.ok || (lat.value == null) !== (lng.value == null)) errors.push('The map pin is not valid; place it again.');
  if (furnishedRaw && furnishedRaw !== 'yes' && furnishedRaw !== 'no') errors.push('Furnished must be yes or no.');

  return {
    errors,
    fields: {
      title, city, price, purpose,
      address: clean(get('address'), 200),
      district: clean(get('district'), 120) || null,
      type,
      beds: beds.value, baths: baths.value, area_m2: area.value,
      furnished: furnishedRaw === 'yes' ? true : furnishedRaw === 'no' ? false : null,
      description: clean(get('description'), 4000),
      lat: lat.value, lng: lng.value,
      agent_name: '', agent_email: '', agent_phone: phone,
    },
  };
}

module.exports = { validateListing, TYPES };
