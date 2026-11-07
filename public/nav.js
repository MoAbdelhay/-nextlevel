/* MOUJJ top bar: floating glass nav with search, shared by every page.
   Include with <script src="nav.js"></script> right after <body> (and after the SVG sprite);
   it writes the bar in place, so page scripts that follow can use #langtoggle. */
(() => {
  const L = {
    en: { brand: 'MOUJJ', listings: 'Listings', sale: 'For sale', rent: 'For rent', submit: 'Submit',
          search: 'Search district, city…', searchBtn: 'Search', menu: 'Menu',
          credit: 'Powered by <a href="https://takween-studio.com" target="_blank" rel="noopener">Takween Studio</a>' },
    ar: { brand: 'موج', listings: 'العقارات', sale: 'للبيع', rent: 'للإيجار', submit: 'أضف عقارك',
          search: 'ابحث بالحي أو المدينة…', searchBtn: 'بحث', menu: 'القائمة',
          credit: 'مدعوم من <a href="https://takween-studio.com" target="_blank" rel="noopener">تكوين ستوديو</a>' },
  };
  const page = location.pathname.replace(/\/+$/, '/').split('/').pop() || 'index.html';
  const isHome = page === '' || page === 'index.html';
  const qs = new URLSearchParams(location.search);
  const active = /^listings(\.html)?$/.test(page) ? (qs.get('for') || 'listings') : '';
  const submitHref = isHome ? '#submit' : './#submit';

  const icon = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  const links = (cls) => ['listings', 'sale', 'rent', 'submit'].map(k => {
    const href = k === 'listings' ? 'listings.html' : k === 'submit' ? submitHref : 'listings.html?for=' + k;
    return `<a class="${cls}${active === k ? ' on' : ''}" data-k="${k}" href="${href}"${active === k ? ' aria-current="page"' : ''}></a>`;
  }).join('');

  const html = `
<nav class="topnav" id="topnav" aria-label="Main">
  <div class="tn-in">
    <a class="tn-brand" href="./" aria-label="MOUJJ home"><svg class="mark" aria-hidden="true"><use href="#nl-mark"/></svg><span data-k="brand"></span></a>
    <div class="tn-links">${links('tn-link')}</div>
    <form class="tn-search" role="search" action="listings.html" method="get">
      <span class="tn-ico">${icon.search}</span>
      <input type="search" name="q" autocomplete="off" enterkeyhint="search" dir="auto">
      <button type="submit" class="tn-go" data-k="searchBtn"></button>
    </form>
    <button class="langtoggle tn-lang" id="langtoggle" type="button" aria-label="Switch language / تغيير اللغة">عربي</button>
    <button class="tn-menu" type="button" aria-expanded="false" aria-controls="tn-drawer">${icon.menu}</button>
  </div>
  <div class="tn-drawer" id="tn-drawer" hidden>
    ${links('tn-dlink')}
  </div>
</nav>`;
  const me = document.currentScript;
  me.insertAdjacentHTML('beforebegin', html);
  const nav = document.getElementById('topnav');

  /* "Powered by Takween Studio": bottom-right of the page (the home hero, or the page footer) */
  const credit = document.createElement('div');
  credit.className = 'site-credit';
  credit.dataset.k = 'credit';
  window.addEventListener('DOMContentLoaded', () => {
    const footer = document.querySelector('footer .shell');
    if (footer) { footer.classList.add('credit-row'); footer.append(credit); }
    else (document.getElementById('hero') || document.body).append(credit);
    label();
  });
  const input = nav.querySelector('.tn-search input');
  const menuBtn = nav.querySelector('.tn-menu');
  const drawer = nav.querySelector('.tn-drawer');
  input.value = qs.get('q') || '';

  function label() {
    const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    const T = L[lang];
    [...nav.querySelectorAll('[data-k]'), credit].forEach(el => {
      const v = T[el.dataset.k];
      if (v == null) return;
      if (el.dataset.k === 'credit') el.innerHTML = v; else el.textContent = v;
    });
    input.placeholder = T.search;
    input.setAttribute('aria-label', T.search);
    menuBtn.setAttribute('aria-label', T.menu);
  }
  label();
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  /* menu on narrow screens */
  function setMenu(open) {
    drawer.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open);
    nav.classList.toggle('open', open);
  }
  menuBtn.addEventListener('click', () => setMenu(drawer.hidden));
  document.addEventListener('click', e => { if (!nav.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* "Submit" on the home page: go to the form's first field */
  nav.querySelectorAll('[data-k=submit]').forEach(a => a.addEventListener('click', e => {
    const first = document.querySelector('#listingform [name=title]');
    if (!first) return;
    e.preventDefault(); setMenu(false);
    first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    first.focus({ preventScroll: true });
  }));

  /* on the listings page the bar filters live; elsewhere Enter opens the listings page */
  window.addEventListener('DOMContentLoaded', () => {
    const ps = document.getElementById('lsearch');
    if (!ps) return;
    if (input.value) { ps.value = input.value; ps.dispatchEvent(new Event('input')); }
    input.addEventListener('input', () => { ps.value = input.value; ps.dispatchEvent(new Event('input')); });
    ps.addEventListener('input', () => { if (input.value !== ps.value) input.value = ps.value; });
    nav.querySelector('.tn-search').addEventListener('submit', e => { e.preventDefault(); input.blur(); });
  });
})();
