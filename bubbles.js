/* Mouj — click the water: bubbles rise and a small fish darts away. */
(() => {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const cv = document.getElementById('bubbles');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0;
  function size(){
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size(); addEventListener('resize', size);

  const bubbles = [];
  let running = false, last = 0;
  function burst(x, y){
    const n = REDUCED ? 6 : 16 + (Math.random() * 8 | 0);
    for (let i = 0; i < n; i++) bubbles.push({
      x: x + rand(-13, 13), y: y + rand(-7, 7), r: rand(2, 9), vy: rand(40, 130),
      wob: Math.random() * 6.28, wobS: rand(2, 5), life: 0, max: rand(1.6, 3.2),
    });
    if (!running){ running = true; last = performance.now(); requestAnimationFrame(tick); }
  }
  function tick(now){
    const dt = Math.min((now - last) / 1000, .05); last = now;
    ctx.clearRect(0, 0, W, H);
    for (let i = bubbles.length - 1; i >= 0; i--){
      const b = bubbles[i];
      b.life += dt; b.y -= b.vy * dt; b.vy *= 1 + dt * .4; b.wob += b.wobS * dt; b.r *= 1 + dt * .08;
      const x = b.x + Math.sin(b.wob) * 4;
      const a = Math.min(1, b.life * 6) * Math.max(0, 1 - b.life / b.max);
      if (a <= 0 || b.y < -20){ bubbles.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, 6.2832);
      ctx.fillStyle = `rgba(150,215,240,${.08 * a})`; ctx.fill();
      ctx.lineWidth = 1.1; ctx.strokeStyle = `rgba(200,240,250,${.75 * a})`; ctx.stroke();
      ctx.beginPath(); ctx.arc(x - b.r * .35, b.y - b.r * .35, b.r * .28, 0, 6.2832);
      ctx.fillStyle = `rgba(255,255,255,${.7 * a})`; ctx.fill();
    }
    if (bubbles.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }

  function dart(x, y){
    if (REDUCED) return;
    const f = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    f.setAttribute('viewBox', '0 0 40 20');
    f.setAttribute('class', 'fish darter ' + (Math.random() < .5 ? 'gold' : 'pale'));
    f.setAttribute('aria-hidden', 'true');
    f.innerHTML = '<path d="M2 10C8 2.5 21 2.5 29 10 21 17.5 8 17.5 2 10Z" class="fill"/>' +
      '<path d="M29 10 39 3.5 37 10 39 16.5Z" class="fill"/><circle cx="8" cy="9" r="1.4" class="eye"/>';
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
    if (e.target.closest('a,button,input,select,textarea,label,.formglass,.scrub,.langtoggle')) return;
    burst(e.clientX, e.clientY);
    dart(e.clientX, e.clientY);
  });
})();
