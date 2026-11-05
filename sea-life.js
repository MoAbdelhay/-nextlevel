/* Mouj — the deep below the hero.
   A swarm of glass jellyfish + drifting specks drawn on a canvas, schools of fish
   swimming across, a depth gauge while you dive, and bubbles + a darting fish on click. */
(() => {
  const depths = document.getElementById('depths');
  if (!depths) return;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const rand = (a, b) => a + Math.random() * (b - a);

  /* =================== glass jellyfish (canvas) =================== */
  const cv = document.getElementById('deepcanvas');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  /* jellies live in "section space": x 0..1 across, y 0..1 down the section */
  const jellies = [];
  function seed(){
    jellies.length = 0;
    const count = innerWidth < 700 ? 22 : 38;
    for (let i = 0; i < count; i++){
      const z = Math.pow(Math.random(), 1.4);          /* 0 far · 1 near */
      jellies.push({
        x: Math.random(), y: Math.random(),
        z, r: 10 + z * 52 + Math.random() * 10,          /* bell radius in px */
        phase: Math.random() * 6.28, rate: rand(.55, 1.1),
        drift: rand(-.006, .006), rise: rand(.004, .012),
        tilt: rand(-.25, .25), hue: Math.random(),       /* rim tint: cyan ↔ pink balance */
        px: 0, py: 0, vx: 0, vy: 0,                      /* push from the pointer, in px */
      });
    }
    jellies.sort((a, b) => a.z - b.z);                   /* far ones first */
  }
  const specks = Array.from({ length: 140 }, () => ({
    x: Math.random(), y: Math.random(), s: rand(.5, 2.2), a: rand(.15, .6), v: rand(.002, .008), tw: Math.random() * 6.28,
  }));

  function size(){
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    for (const c of [cv, bcv]){ c.width = W * DPR; c.height = H * DPR; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function drawJelly(j, sx, sy, t, fade){
    const r = j.r;
    const beat = Math.sin(t * j.rate * 2.2 + j.phase);   /* bell contracts and relaxes */
    const squeeze = 1 + beat * .07;
    const bw = r * (1 - beat * .06), bh = r * .92 * squeeze;
    const alpha = (.35 + j.z * .65) * fade;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(j.tilt + Math.sin(t * .3 + j.phase) * .06);

    /* trailing glass body: a long soft cone below the bell */
    const L = r * (2.3 + .25 * Math.sin(t * j.rate + j.phase + 1));
    const sway = Math.sin(t * j.rate * 1.3 + j.phase) * r * .18;
    const body = ctx.createLinearGradient(0, 0, 0, L);
    body.addColorStop(0, `rgba(70,120,150,${.32 * alpha})`);
    body.addColorStop(.5, `rgba(40,70,100,${.14 * alpha})`);
    body.addColorStop(1, 'rgba(20,40,70,0)');
    ctx.beginPath();
    ctx.moveTo(-bw * .86, 0);
    ctx.quadraticCurveTo(-bw * .5 + sway * .5, L * .55, sway, L);
    ctx.quadraticCurveTo(bw * .5 + sway * .5, L * .55, bw * .86, 0);
    ctx.closePath();
    ctx.fillStyle = body; ctx.fill();
    /* faint edges of the cone */
    ctx.lineWidth = .8;
    ctx.strokeStyle = `rgba(160,210,230,${.12 * alpha})`;
    ctx.stroke();

    /* bell: dome with a small flared skirt */
    ctx.beginPath();
    ctx.moveTo(-bw, 0);
    ctx.bezierCurveTo(-bw, -bh * 1.32, bw, -bh * 1.32, bw, 0);
    ctx.quadraticCurveTo(bw * .9, bh * .12, bw * .78, bh * .1);
    ctx.lineTo(-bw * .78, bh * .1);
    ctx.quadraticCurveTo(-bw * .9, bh * .12, -bw, 0);
    const fill = ctx.createRadialGradient(-bw * .2, -bh * .55, r * .1, 0, -bh * .3, r * 1.2);
    fill.addColorStop(0, `rgba(60,110,130,${.55 * alpha})`);
    fill.addColorStop(.6, `rgba(30,55,80,${.5 * alpha})`);
    fill.addColorStop(1, `rgba(90,50,80,${.45 * alpha})`);
    ctx.fillStyle = fill; ctx.fill();

    /* iridescent rim light: cyan on one side, rose on the other */
    const cyan = `rgba(120,240,230,${.95 * alpha})`, rose = `rgba(240,170,210,${.85 * alpha})`;
    const rim = ctx.createLinearGradient(-bw, 0, bw, 0);
    rim.addColorStop(0, j.hue < .5 ? cyan : rose);
    rim.addColorStop(.5, `rgba(235,245,255,${.9 * alpha})`);
    rim.addColorStop(1, j.hue < .5 ? rose : cyan);
    ctx.beginPath();
    ctx.moveTo(-bw, 0);
    ctx.bezierCurveTo(-bw, -bh * 1.32, bw, -bh * 1.32, bw, 0);
    ctx.lineWidth = 1.2 + j.z * 2;
    ctx.strokeStyle = rim;
    ctx.shadowColor = j.hue < .5 ? 'rgba(110,235,225,.8)' : 'rgba(240,160,210,.8)';
    ctx.shadowBlur = 6 + j.z * 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* skirt line + inner highlight */
    ctx.beginPath();
    ctx.moveTo(-bw * .98, bh * .02); ctx.lineTo(bw * .98, bh * .02);
    ctx.lineWidth = .8; ctx.strokeStyle = `rgba(200,235,240,${.25 * alpha})`; ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-bw * .35, -bh * .72, bw * .28, bh * .12, -.5, 0, 6.28);
    ctx.fillStyle = `rgba(255,255,255,${.12 * alpha})`; ctx.fill();
    ctx.restore();
  }

  /* 0 at the section's top/bottom edge, 1 once ~25% of a screen inside, so nothing is cut off */
  function edgeFade(y, r){
    const band = Math.max(160, H * .28);
    const top = (y - r.top) / band, bot = (r.bottom - y) / band;
    const f = Math.max(0, Math.min(1, top, bot));
    return f * f * (3 - 2 * f);
  }

  /* pointer: jellies ease away from the hand */
  let pX = -9999, pY = -9999;
  addEventListener('pointermove', e => { pX = e.clientX; pY = e.clientY; }, { passive: true });
  addEventListener('pointerleave', () => { pX = pY = -9999; });

  let visible = false, lastT = performance.now(), start = lastT;
  function frame(now){
    const dt = Math.min((now - lastT) / 1000, .05); lastT = now;
    const t = REDUCED ? 0 : (now - start) / 1000;
    const r = depths.getBoundingClientRect();
    ctx.clearRect(0, 0, W, H);
    if (r.bottom > 0 && r.top < H){
      ctx.save();
      ctx.beginPath(); ctx.rect(0, Math.max(0, r.top), W, Math.min(H, r.bottom) - Math.max(0, r.top)); ctx.clip();

      /* drifting specks */
      for (const s of specks){
        if (!REDUCED){ s.y -= s.v * dt * .15; if (s.y < 0) s.y += 1; }
        const y = r.top + s.y * r.height * .98;
        if (y < -5 || y > H + 5) continue;
        const a = s.a * (.6 + .4 * Math.sin(t * 1.3 + s.tw)) * edgeFade(y, r);
        ctx.beginPath(); ctx.arc(s.x * W, y, s.s, 0, 6.28);
        ctx.fillStyle = `rgba(150,220,220,${a})`; ctx.fill();
      }

      for (const j of jellies){
        if (!REDUCED){
          j.y -= j.rise * dt * (.6 + .5 * Math.max(0, Math.sin(t * j.rate * 2.2 + j.phase)));
          j.x += j.drift * dt;
          if (j.y < -.05) j.y += 1.1;
          if (j.x < -.05) j.x += 1.1; else if (j.x > 1.05) j.x -= 1.1;
        }
        /* nearer jellies move a little faster with scroll (depth) */
        const par = (j.z - .5) * .25;
        let sx = j.x * W + j.px;
        let sy = r.top + j.y * r.height + (r.top - H / 2) * par + j.py;
        if (sy < -j.r * 4 || sy > H + j.r * 2) continue;
        /* push from pointer */
        const dx = sx - pX, dy = sy - pY, d2 = dx * dx + dy * dy, R = 140 + j.r * 2;
        if (!REDUCED && d2 < R * R){
          const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 260 * dt;
          j.vx += dx / d * f; j.vy += dy / d * f;
        }
        j.vx *= Math.exp(-dt * 2.2); j.vy *= Math.exp(-dt * 2.2);
        j.px = (j.px + j.vx * dt * 6) * Math.exp(-dt * .6);
        j.py = (j.py + j.vy * dt * 6) * Math.exp(-dt * .6);
        const fade = edgeFade(sy, r);
        if (fade > 0.01) drawJelly(j, sx, sy, t, fade);
      }
      ctx.restore();
    }
    if (visible) requestAnimationFrame(frame);
  }
  new IntersectionObserver(es => {
    const v = es[0].isIntersecting;
    if (v && !visible){ visible = true; lastT = performance.now(); requestAnimationFrame(frame); }
    visible = v;
    if (!v) ctx.clearRect(0, 0, W, H);
  }).observe(depths);

  /* =================== schools of fish (SVG) =================== */
  const FISH = `<path d="M2 10C8 2.5 21 2.5 29 10 21 17.5 8 17.5 2 10Z" class="fill"/>
    <path d="M29 10 39 3.5 37 10 39 16.5Z" class="fill"/><circle cx="8" cy="9" r="1.4" class="eye"/>`;
  function fish(cls){
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 40 20');
    s.setAttribute('class', 'cr-art fish ' + (cls || ''));
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = FISH;
    return s;
  }
  const SCHOOLS = [
    { top: 12, n: 9,  tint: 'gold', swim: -34 },
    { top: 30, n: 12, tint: 'pale', swim: 28, delay: -9 },
    { top: 52, n: 8,  tint: 'pale', swim: -24, delay: -4 },
    { top: 70, n: 11, tint: 'gold', swim: 40, delay: -18 },
    { top: 86, n: 7,  tint: 'pale', swim: -30, delay: -12 },
  ];
  for (const c of SCHOOLS){
    const lane = document.createElement('div');
    lane.className = 'cr-lane';
    lane.style.top = c.top + '%';
    const sw = document.createElement('div');
    sw.className = 'cr swims ' + (c.swim > 0 ? 'to-right' : 'to-left');
    sw.style.animationDuration = Math.abs(c.swim) + 's';
    if (c.delay) sw.style.animationDelay = c.delay + 's';
    const school = document.createElement('div');
    school.className = 'school ' + c.tint;
    for (let i = 0; i < c.n; i++){
      const f = fish();
      const s = 14 + Math.random() * 14;
      f.style.width = s + 'px';
      f.style.left = (Math.random() * 160) + 'px';
      f.style.top = (Math.random() * 70) + 'px';
      f.style.animationDelay = (-Math.random() * 2) + 's';
      school.append(f);
    }
    sw.append(school); lane.append(sw); depths.append(lane);
  }

  /* =================== depth gauge =================== */
  const gauge = document.getElementById('depthgauge');
  function onScroll(){
    const r = depths.getBoundingClientRect();
    const inView = r.top < H * .6 && r.bottom > H * .4;
    gauge.classList.toggle('on', inView);
    const p = Math.max(0, Math.min(1, (H / 2 - r.top) / r.height));
    const num = gauge.querySelector('b');
    if (num) num.textContent = Math.round(Math.pow(p, 1.6) * 1000);
  }
  addEventListener('scroll', onScroll, { passive: true });

  /* =================== bubbles + darting fish on click =================== */
  const bcv = document.getElementById('bubbles');
  const bctx = bcv.getContext('2d');
  const bubbles = [];
  let bRunning = false, bLast = 0;
  function burst(x, y){
    const n = REDUCED ? 6 : 16 + (Math.random() * 8 | 0);
    for (let i = 0; i < n; i++) bubbles.push({
      x: x + rand(-13, 13), y: y + rand(-7, 7), r: rand(2, 9), vy: rand(40, 130),
      wob: Math.random() * 6.28, wobS: rand(2, 5), life: 0, max: rand(1.6, 3.2),
    });
    if (!bRunning){ bRunning = true; bLast = performance.now(); requestAnimationFrame(btick); }
  }
  function btick(now){
    const dt = Math.min((now - bLast) / 1000, .05); bLast = now;
    bctx.clearRect(0, 0, W, H);
    for (let i = bubbles.length - 1; i >= 0; i--){
      const b = bubbles[i];
      b.life += dt; b.y -= b.vy * dt; b.vy *= 1 + dt * .4; b.wob += b.wobS * dt; b.r *= 1 + dt * .08;
      const x = b.x + Math.sin(b.wob) * 4;
      const a = Math.min(1, b.life * 6) * Math.max(0, 1 - b.life / b.max);
      if (a <= 0 || b.y < -20){ bubbles.splice(i, 1); continue; }
      bctx.beginPath(); bctx.arc(x, b.y, b.r, 0, 6.2832);
      bctx.fillStyle = `rgba(150,215,240,${.08 * a})`; bctx.fill();
      bctx.lineWidth = 1.1; bctx.strokeStyle = `rgba(200,240,250,${.75 * a})`; bctx.stroke();
      bctx.beginPath(); bctx.arc(x - b.r * .35, b.y - b.r * .35, b.r * .28, 0, 6.2832);
      bctx.fillStyle = `rgba(255,255,255,${.7 * a})`; bctx.fill();
    }
    if (bubbles.length) requestAnimationFrame(btick);
    else { bRunning = false; bctx.clearRect(0, 0, W, H); }
  }
  function dart(x, y){
    if (REDUCED) return;
    const f = fish(Math.random() < .5 ? 'gold' : 'pale');
    f.classList.add('darter');
    const s = rand(22, 36);
    f.style.width = s + 'px';
    f.style.left = (x - s / 2) + 'px'; f.style.top = (y - s / 4) + 'px';
    const right = Math.random() < .5;
    const dx = (right ? 1 : -1) * rand(220, 420), dy = rand(-100, 60);
    const flip = right ? 'scaleX(-1)' : 'scaleX(1)';
    document.body.append(f);
    f.animate([
      { transform: `translate(0,0) ${flip} scale(.4)`, opacity: 0 },
      { transform: `translate(${dx * .15}px,${dy * .1}px) ${flip} scale(1)`, opacity: 1, offset: .15 },
      { transform: `translate(${dx}px,${dy}px) ${flip} scale(.9)`, opacity: 0 },
    ], { duration: rand(1500, 2000), easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => f.remove();
  }
  addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('a,button,input,select,textarea,label,.formglass,.scrub,.langtoggle,#contact .cell')) return;
    burst(e.clientX, e.clientY);
    dart(e.clientX, e.clientY);
  });

  size(); seed(); onScroll();
  addEventListener('resize', () => { size(); onScroll(); });
})();
