// "Parkinson's: from subjective scores to objective data" - 75 s intro film
// Shots: numbers -> title -> brain -> neurons -> cup tremor -> writing -> gait -> UPDRS finger tapping -> UPDRS sheet -> mmWave radar -> depth camera -> end
const SHOTS = [
  { d: 9, k: 'numbers' }, { d: 5, k: 'title' }, { d: 6, k: 'brain' }, { d: 6, k: 'neurons' },
  { d: 5, k: 'cup' }, { d: 5, k: 'pen' }, { d: 5, k: 'gait' }, { d: 6, k: 'tap' }, { d: 6, k: 'updrs' },
  { d: 8, k: 'radar' }, { d: 8, k: 'depth' }, { d: 6, k: 'end' }];
{ let a = 0; SHOTS.forEach(s => { s.f0 = a; s.n = s.d * FPS; a += s.n; }); }

// ---------- generic 3D helpers for the 2D-drawn scenes ----------
function camera(pos, target, zoom) {
  const f = norm(sub(target, pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  return { pos, f, r, u, zoom, p(P) { const d = sub(P, pos); const z = dot(d, f); return [W / 2 + dot(d, r) / z * zoom * H, H / 2 - dot(d, u) / z * zoom * H, z]; } };
}
let SEED = 1; const rnd = () => { SEED = (SEED * 16807) % 2147483647; return SEED / 2147483647; };
const gauss = () => { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
function turbo(t) { t = clamp(t);
  const r = 0.13572138 + t * (4.6153926 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943))));
  const g = 0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604))));
  const b = 0.1066733 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973))));
  return [clamp(r) * 255 | 0, clamp(g) * 255 | 0, clamp(b) * 255 | 0]; }
function bgDark(c1 = '#05080c', c2 = '#0b1219') { const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 50, W * 0.5, H * 0.5, W * 0.75); g.addColorStop(0, c2); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function grid(a = 0.05, step = 80) { ctx.save(); ctx.strokeStyle = `rgba(120,170,200,${a})`; ctx.lineWidth = 1; for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore(); }
function tag(str, x, y, a, color = '57,198,232') { text(str, x, y, 16, { a: a * 0.85, ls: 6, align: 'left', color }); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = `rgb(${color})`; ctx.fillRect(x, y + 20, 36, 2); ctx.restore(); }
function corner(x, y, w, h, a, c = 22) { ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
  [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([px, py, sx, sy]) => { ctx.beginPath(); ctx.moveTo(px + sx * c, py); ctx.lineTo(px, py); ctx.lineTo(px, py + sy * c); ctx.stroke(); }); ctx.restore(); }
const layer = (() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return { c, g: c.getContext('2d') }; })();
const layer2 = (() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return { c, g: c.getContext('2d') }; })();

// ---------- A. numbers ----------
const GLOBE = (() => { const pts = []; const N = 2600; for (let i = 0; i < N; i++) { const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996323;
  pts.push([Math.cos(th) * r, y, Math.sin(th) * r, rnd()]); } return pts; })();
const DATA = [[1990, 2.5], [2016, 6.1], [2021, 11.9], [2050, 25.2]];
function sceneNumbers(t, sec) {
  bgDark(); grid(0.035);
  // value timeline
  const seg = [[0.04, 0.3, 0, 1], [0.34, 0.56, 1, 2], [0.56, 0.62, 2, 2], [0.64, 0.9, 2, 3]];
  let yr = 1990, val = 2.5, idx = 0;
  seg.forEach(([a, b, i0, i1]) => { if (t >= a) { const k = easeIO(ramp(t, a, b)); yr = lerp(DATA[i0][0], DATA[i1][0], k); val = lerp(DATA[i0][1], DATA[i1][1], k); idx = k > 0.99 ? i1 : i0; } });
  // globe
  const cx = W * 0.73, cy = H * 0.47, R = 330, rot = sec * 0.18;
  const frac = val / 25.2;
  ctx.save();
  GLOBE.forEach(([x, y, z, s]) => { const xr = x * Math.cos(rot) + z * Math.sin(rot), zr = -x * Math.sin(rot) + z * Math.cos(rot);
    const px = cx + xr * R, py = cy - y * R * 0.98 - zr * 0; const front = zr > -0.1 ? 1 : 0.25; const lit = s < frac * 0.55;
    ctx.fillStyle = lit ? `rgba(255,170,90,${0.9 * front})` : `rgba(120,180,210,${0.32 * front})`;
    const sz = lit ? 3.2 : 2.0; ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz); });
  const g = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25); g.addColorStop(0, 'rgba(57,198,232,0)'); g.addColorStop(0.8, 'rgba(57,198,232,0.06)'); g.addColorStop(1, 'rgba(57,198,232,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, 7); ctx.fill(); ctx.restore();
  // counter
  const a0 = ease(ramp(t, 0.0, 0.06)) * (1 - ease(ramp(t, 0.95, 1)));
  tag('PEOPLE LIVING WITH PARKINSON\'S DISEASE', 150, 250, a0);
  text(Math.round(yr).toString(), 150, 330, 34, { align: 'left', a: a0 * 0.8, ls: 8, color: '160,190,210', w: 300 });
  text(Math.round(val * 1e6).toLocaleString('en-US'), 145, 440, 132, { align: 'left', a: a0, w: 200, ls: 2 });
  if (t > 0.64) text('PROJECTED', 152, 530, 18, { align: 'left', a: a0 * ease(ramp(t, 0.64, 0.7)), ls: 8, color: '255,170,90', w: 500 });
  // chart
  const X0 = 150, Y0 = 860, CW = 760, CH = 230;
  ctx.save(); ctx.globalAlpha = a0; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X0 + CW, Y0); ctx.stroke();
  const P = ([y, v]) => [X0 + (y - 1990) / 60 * CW, Y0 - v / 25.2 * CH];
  const upto = yr;
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#39c6e8'; ctx.beginPath();
  for (let i = 0; i < DATA.length - 1; i++) { const [y0, v0] = DATA[i], [y1, v1] = DATA[i + 1]; if (upto <= y0) break; const k = clamp((upto - y0) / (y1 - y0)); const p0 = P(DATA[i]), p1 = P([lerp(y0, y1, k), lerp(v0, v1, k)]);
    if (i === 2) { ctx.stroke(); ctx.beginPath(); ctx.setLineDash([8, 8]); ctx.strokeStyle = '#ffaa5a'; }
    ctx.moveTo(...p0); ctx.lineTo(...p1); }
  ctx.stroke(); ctx.setLineDash([]);
  DATA.forEach((d, i) => { if (upto >= d[0] - 0.01) { const p = P(d); ctx.fillStyle = i === 3 ? '#ffaa5a' : '#39c6e8'; ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 7); ctx.fill();
    text(d[0] + '', p[0], Y0 + 28, 15, { a: 0.7, ls: 2 }); text(d[1] + 'M', p[0], p[1] - 22, 16, { a: 0.9, ls: 1, w: 500 }); } });
  ctx.restore();
  text('Source: GBD 2016 (Lancet Neurol 2018); GBD 2021 projection (BMJ 2025)', 150, H - 50, 13, { align: 'left', a: a0 * 0.45, ls: 1, w: 400 });
}
// ---------- B. title ----------
const DUST = Array.from({ length: 420 }, () => [rnd() * W, rnd() * H, rnd() * 0.8 + 0.2, rnd()]);
function sceneTitle(t, sec) {
  bgDark('#030507', '#0a1016');
  DUST.forEach(([x, y, s, p]) => { ctx.fillStyle = `rgba(150,200,230,${0.08 + 0.18 * s})`; const yy = (y - sec * 12 * s + H) % H; ctx.fillRect(x + Math.sin(sec * 0.5 + p * 9) * 8, yy, 1.6 * s, 1.6 * s); });
  const word = "PARKINSON'S DISEASE"; ctx.save(); ctx.font = `200 78px ${FONT}`; ctx.letterSpacing = '0px'; ctx.textBaseline = 'middle';
  const LS = 16; let total = 0; [...word].forEach(ch => total += ctx.measureText(ch).width + LS); total -= LS; let x = W / 2 - total / 2;
  [...word].forEach((ch, i) => { const k = ease(ramp(t, 0.05 + i * 0.018, 0.3 + i * 0.018)); ctx.fillStyle = `rgba(255,255,255,${k})`; ctx.fillText(ch, x, H / 2 - 20 + (1 - k) * 30); x += ctx.measureText(ch).width + LS; });
  ctx.restore();
  const a = ease(ramp(t, 0.45, 0.65)) * (1 - ease(ramp(t, 0.92, 1)));
  ctx.fillStyle = `rgba(57,198,232,${a})`; ctx.fillRect(W / 2 - 150 * a, H / 2 + 52, 300 * a, 1.5);
  text('ONE OF THE FASTEST-GROWING NEUROLOGICAL DISORDERS IN THE WORLD', W / 2, H / 2 + 100, 18, { a: a * 0.8, ls: 8, w: 400, color: '170,195,210' });
}
// ---------- C. brain point cloud ----------
const BRAIN = (() => { const pts = []; SEED = 99;
  const gy = (x, y, z) => 0.035 * Math.sin(x * 23 + Math.sin(y * 17) * 2) * Math.sin(y * 19 + z * 13) + 0.02 * Math.sin(z * 31 + x * 11);
  for (let i = 0; i < 26000; i++) { // cerebrum: two hemispheres
    let d = norm([gauss(), gauss(), gauss()]); const side = d[0] >= 0 ? 1 : -1;
    let p = [d[0] * 0.33 + side * 0.035, d[1] * 0.36, d[2] * 0.5]; if (p[1] < -0.12) p[1] = -0.12 + (p[1] + 0.12) * 0.55;
    const s = 1 + gy(p[0], p[1], p[2]) * 1.6; pts.push([p[0] * s, p[1] * s + 0.05, p[2] * s, 0]); }
  for (let i = 0; i < 5000; i++) { const d = norm([gauss(), gauss(), gauss()]); const f = 1 + 0.04 * Math.sin(d[1] * 60); pts.push([d[0] * 0.24 * f, d[1] * 0.12 * f - 0.27, d[2] * 0.15 * f - 0.36, 1]); } // cerebellum
  for (let i = 0; i < 2600; i++) { const a = rnd() * TAU, h = rnd(); pts.push([Math.cos(a) * 0.075, -0.1 - h * 0.42, Math.sin(a) * 0.075 - 0.12 - h * 0.08, 2]); } // brainstem
  for (let i = 0; i < 900; i++) { const side = rnd() < 0.5 ? -1 : 1; const a = rnd() * Math.PI; pts.push([side * (0.06 + Math.cos(a) * 0.03) + gauss() * 0.006, -0.12 + gauss() * 0.012, -0.08 + Math.sin(a) * 0.035 + gauss() * 0.006, 3]); } // substantia nigra
  return pts; })();
function sceneBrain(t, sec) {
  bgDark('#020305', '#081018');
  const ang = lerp(-0.9, 0.55, easeIO(t)), dist = lerp(2.6, 1.15, easeIO(ramp(t, 0.3, 1)));
  const tgt = lerp3([0, 0, 0], [0, -0.11, -0.08], easeIO(ramp(t, 0.35, 1)));
  const cam = camera([Math.sin(ang) * dist, lerp(0.35, 0.12, t), Math.cos(ang) * dist], tgt, 1.6);
  const fade = ease(ramp(t, 0.35, 0.8));
  layer.g.clearRect(0, 0, W, H); const g = layer.g; g.globalCompositeOperation = 'lighter';
  BRAIN.forEach(([x, y, z, k]) => { const p = cam.p([x, y, z]); if (p[2] <= 0.05) return;
    const s = 1.4 / p[2];
    if (k === 3) { const pulse = 0.65 + 0.35 * Math.sin(sec * 3); g.fillStyle = `rgba(255,${160 - fade * 40},70,${(0.25 + 0.75 * fade) * pulse})`; const sz = 3.2 * s; g.fillRect(p[0] - sz / 2, p[1] - sz / 2, sz, sz); return; }
    const a = (k === 0 ? 0.22 : k === 1 ? 0.26 : 0.3) * (1 - fade * 0.55);
    g.fillStyle = k === 2 ? `rgba(120,170,255,${a})` : `rgba(90,190,235,${a})`; const sz = 1.7 * s; g.fillRect(p[0] - sz / 2, p[1] - sz / 2, sz, sz); });
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(layer.c, 0, 0); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(8px)'; ctx.globalAlpha = 0.6; ctx.drawImage(layer.c, 0, 0); ctx.restore();
  const sn = cam.p([0.06, -0.12, -0.08]);
  const la = ease(ramp(t, 0.6, 0.78));
  if (la > 0) { ctx.save(); ctx.globalAlpha = la; ctx.strokeStyle = 'rgba(255,170,90,0.8)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(sn[0] + 40, sn[1]); ctx.lineTo(sn[0] + 220, sn[1] - 120); ctx.lineTo(sn[0] + 420, sn[1] - 120); ctx.stroke(); ctx.restore();
    text('SUBSTANTIA NIGRA', sn[0] + 230, sn[1] - 145, 20, { align: 'left', a: la, ls: 6, w: 400 }); text('MIDBRAIN · DOPAMINE PRODUCTION', sn[0] + 230, sn[1] - 96, 14, { align: 'left', a: la * 0.7, ls: 4, color: '255,170,90' }); }
}
// ---------- D. neurons ----------
const NEURONS = (() => { SEED = 7; const ns = [];
  for (let i = 0; i < 16; i++) { const soma = [gauss() * 1.6, gauss() * 0.9, -rnd() * 4.5 + 1.2]; const br = [];
    const grow = (p, d, L, depth) => { const pts = [p]; let q = p, dd = d; const n = 8; for (let k = 0; k < n; k++) { dd = norm(add(dd, [gauss() * 0.35, gauss() * 0.35, gauss() * 0.35])); q = add(q, mul(dd, L / n)); pts.push(q); }
      br.push({ pts, w: 3.5 - depth }); if (depth < 2) for (let j = 0; j < 2; j++) grow(pts[4 + j * 3] || q, norm(add(dd, [gauss(), gauss(), gauss()])), L * 0.55, depth + 1); };
    for (let j = 0; j < 5; j++) grow(soma, norm([gauss(), gauss(), gauss()]), 0.55 + rnd() * 0.4, 0);
    ns.push({ soma, br, axon: null, ph: rnd(), die: rnd() < 0.62, dieAt: 0.35 + rnd() * 0.4 }); }
  ns.forEach((n, i) => { const m = ns[(i + 5) % ns.length]; const pts = []; for (let k = 0; k <= 30; k++) { const u = k / 30; const mid = add(mul(add(n.soma, m.soma), 0.5), [Math.sin(i) * 0.6, Math.cos(i * 1.7) * 0.6, 0.3]);
    const a = lerp3(n.soma, mid, u), b = lerp3(mid, m.soma, u); pts.push(lerp3(a, b, u)); } n.axon = pts; });
  return ns; })();
function pathAt(pts, u) { const f = clamp(u) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)); return lerp3(pts[i], pts[i + 1], f - i); }
function sceneNeurons(t, sec) {
  bgDark('#030406', '#0b0d14');
  const cam = camera(lerp3([0.4, 0.2, 4.2], [-0.2, 0.05, 2.9], easeIO(t)), [0, 0, -1], 1.4);
  const focus = 3.4;
  const layers = [[], [], []];
  NEURONS.forEach(n => { const z = cam.p(n.soma)[2]; layers[Math.min(2, Math.floor(Math.abs(z - focus) / 1.1))].push(n); });
  const healthy = n => n.die ? 1 - ease(ramp(t, n.dieAt, n.dieAt + 0.22)) : 1;
  const drawN = (g, n) => { const h = healthy(n); const warm = h;
    const col = (a) => `rgba(${lerp(140, 255, warm) | 0},${lerp(150, 190, warm) | 0},${lerp(170, 120, warm) | 0},${a})`;
    g.lineCap = 'round';
    n.br.forEach(b => { const keep = Math.max(2, Math.floor(b.pts.length * lerp(0.35, 1, h))); g.beginPath(); b.pts.slice(0, keep).forEach((p, i) => { const q = cam.p(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
      const z = cam.p(b.pts[0])[2]; g.strokeStyle = col(0.18 + 0.5 * h); g.lineWidth = Math.max(0.6, b.w * 2.4 / z); g.stroke(); });
    { const keep = Math.floor(n.axon.length * lerp(0.15, 1, h)); g.beginPath(); n.axon.slice(0, keep).forEach((p, i) => { const q = cam.p(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.strokeStyle = col(0.12 + 0.4 * h); g.lineWidth = 2.2 / cam.p(n.soma)[2]; g.stroke(); }
    const s = cam.p(n.soma); const r = 26 / s[2]; const gr = g.createRadialGradient(s[0], s[1], 0, s[0], s[1], r * 2.4);
    gr.addColorStop(0, col(0.95 * (0.3 + 0.7 * h))); gr.addColorStop(0.35, col(0.35 * h + 0.08)); gr.addColorStop(1, col(0)); g.fillStyle = gr; g.beginPath(); g.arc(s[0], s[1], r * 2.4, 0, 7); g.fill();
    // dopamine pulses along the axon
    if (h > 0.05) for (let k = 0; k < 4; k++) { const u = (sec * 0.32 + n.ph + k * 0.25) % 1; if (u > lerp(0.15, 1, h)) continue; const q = cam.p(pathAt(n.axon, u)); const rr = 9 / q[2];
      const pg2 = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr * 3); pg2.addColorStop(0, `rgba(255,210,120,${0.95 * h})`); pg2.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = pg2; g.beginPath(); g.arc(q[0], q[1], rr * 3, 0, 7); g.fill(); }
  };
  [2, 1, 0].forEach(li => { const L = li === 0 ? ctx : layer.g; if (li) layer.g.clearRect(0, 0, W, H);
    L.save(); L.globalCompositeOperation = 'lighter'; layers[li].forEach(n => drawN(L, n)); L.restore();
    if (li) { ctx.save(); ctx.filter = `blur(${li * 7}px)`; ctx.globalAlpha = li === 2 ? 0.6 : 0.85; ctx.drawImage(layer.c, 0, 0); ctx.restore(); } });
  // debris when neurons degenerate
  SEED = 3; for (let i = 0; i < 160; i++) { const x = rnd() * W, y = rnd() * H, s = rnd(); const a = ease(ramp(t, 0.45, 0.8)) * 0.35 * s; if (a <= 0) continue; ctx.fillStyle = `rgba(170,170,190,${a})`; ctx.fillRect(x + Math.sin(sec + i) * 20, y - sec * 10 * s, 2, 2); }
  const a1 = ease(ramp(t, 0.08, 0.22)) * (1 - ease(ramp(t, 0.5, 0.6))), a2 = ease(ramp(t, 0.6, 0.72));
  tag('DOPAMINERGIC NEURONS', 140, 140, a1, '255,190,110'); tag('NEURONS LOST · DOPAMINE ↓', 140, 140, a2, '200,205,215');
}
// ---------- G/K. Parkinsonian gait skeleton (metres) ----------
function walker(time, o = {}) {
  const T = o.T || 1.25, Ls = o.stride || 0.62, v = Ls / T, ph = TAU * time / T;
  const F = o.F || [1, 0, 0], Lt = norm(cross([0, 1, 0], F)), O = o.O || [0, 0, 0];
  const lean = 0.3, R = (d, h) => [d[0], d[1]];
  const leg = (side, phase) => { const th = 0.21 * Math.sin(phase); const kn = 0.22 + 0.42 * Math.pow(Math.max(0, Math.sin(phase + 1.0)), 2);
    const d1 = [Math.sin(th), -Math.cos(th)], d2 = [Math.sin(th - kn), -Math.cos(th - kn)]; return { side, d1, d2 }; };
  const legs = [leg(1, ph), leg(-1, ph + Math.PI)];
  const thigh = 0.42, shin = 0.41;
  let minA = Infinity; legs.forEach(l => { l.knee = [thigh * l.d1[0], thigh * l.d1[1]]; l.ank = [l.knee[0] + shin * l.d2[0], l.knee[1] + shin * l.d2[1]]; minA = Math.min(minA, l.ank[1]); });
  const pelvisH = 0.08 - minA; const fwd = v * time;
  const W3 = (f, up, lat) => add(O, add(add(mul(F, f), [0, up, 0]), mul(Lt, lat)));
  const J = {}; J.pelvis = W3(fwd, pelvisH, 0);
  legs.forEach(l => { const s = l.side > 0 ? 'R' : 'L'; const lat = l.side * 0.095; J['hip' + s] = W3(fwd, pelvisH, lat); J['knee' + s] = W3(fwd + l.knee[0], pelvisH + l.knee[1], lat); J['ank' + s] = W3(fwd + l.ank[0], pelvisH + l.ank[1], lat); J['toe' + s] = W3(fwd + l.ank[0] + 0.16, pelvisH + l.ank[1] - 0.05, lat * 1.1); });
  const sway = 0.012 * Math.sin(ph);
  J.chest = W3(fwd + Math.sin(lean) * 0.45, pelvisH + Math.cos(lean) * 0.45, sway); J.neck = W3(fwd + Math.sin(lean) * 0.6, pelvisH + Math.cos(lean) * 0.6, sway);
  J.head = W3(fwd + Math.sin(lean) * 0.6 + 0.09, pelvisH + Math.cos(lean) * 0.6 + 0.11, sway);
  [[1, 'R', 0.07], [-1, 'L', 0.035]].forEach(([side, s, amp]) => { const sh = W3(fwd + Math.sin(lean) * 0.55, pelvisH + Math.cos(lean) * 0.55, side * 0.19 + sway);
    const sw = amp * Math.sin(ph + (side > 0 ? Math.PI : 0)) + 0.18; const e = add(sh, add(mul(F, Math.sin(sw) * 0.29), [0, -Math.cos(sw) * 0.29, 0]));
    const fa = sw + 0.75; const wr = add(e, add(mul(F, Math.sin(fa) * 0.25), [0, -Math.cos(fa) * 0.25, 0])); const tr = side > 0 ? 0.006 * Math.sin(time * TAU * 5) : 0;
    J['sh' + s] = sh; J['el' + s] = e; J['wr' + s] = add(wr, [0, tr, 0]); J['hd' + s] = add(add(wr, [0, tr, 0]), add(mul(F, 0.06), [0, -0.06, 0])); });
  return J;
}
const BONE3 = [['pelvis', 'chest', 0.15], ['chest', 'neck', 0.13], ['neck', 'head', 0.06], ['hipR', 'kneeR', 0.075], ['kneeR', 'ankR', 0.055], ['ankR', 'toeR', 0.045], ['hipL', 'kneeL', 0.075], ['kneeL', 'ankL', 0.055], ['ankL', 'toeL', 0.045],
  ['shR', 'elR', 0.05], ['elR', 'wrR', 0.04], ['wrR', 'hdR', 0.042], ['shL', 'elL', 0.05], ['elL', 'wrL', 0.04], ['wrL', 'hdL', 0.042], ['shR', 'shL', 0.07], ['hipR', 'hipL', 0.1]];
function sceneGait(t, sec) {
  // bright minimal corridor, figure as soft silhouette walking slowly
  const g0 = ctx.createLinearGradient(0, 0, 0, H); g0.addColorStop(0, '#d9dde0'); g0.addColorStop(0.62, '#c9ced2'); g0.addColorStop(0.621, '#b9bec2'); g0.addColorStop(1, '#8e9499'); ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = 0.5; for (let i = 0; i < 6; i++) { const x = ((i * 420 - sec * 40) % (W + 420) + W + 420) % (W + 420) - 210; const gw = ctx.createLinearGradient(x, 0, x + 200, 0); gw.addColorStop(0, 'rgba(255,255,255,0)'); gw.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gw.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gw; ctx.fillRect(x, 120, 200, 450); } ctx.restore();
  const J = walker(sec + 0.3, { O: [-0.3, 0, 0] });
  const cam = camera([J.pelvis[0] * 0.6 + 0.2, 0.95, 3.6], [J.pelvis[0] * 0.6 + 0.2, 0.8, 0], 1.25);
  // floor shadow
  layer.g.clearRect(0, 0, W, H); const L = layer.g; L.lineCap = 'round'; L.strokeStyle = 'rgba(30,32,36,1)';
  BONE3.forEach(([a, b, r]) => { const pa = cam.p([J[a][0] + J[a][1] * 0.35, 0.002, J[a][2] - J[a][1] * 0.25]), pb = cam.p([J[b][0] + J[b][1] * 0.35, 0.002, J[b][2] - J[b][1] * 0.25]); L.lineWidth = 2 * r * cam.zoom * H / pa[2]; L.beginPath(); L.moveTo(pa[0], pa[1]); L.lineTo(pb[0], pb[1]); L.stroke(); });
  ctx.save(); ctx.globalAlpha = 0.28; ctx.filter = 'blur(14px)'; ctx.drawImage(layer.c, 0, 0); ctx.restore();
  // figure
  const draw = (col, off) => { BONE3.forEach(([a, b, r]) => { const pa = cam.p(J[a]), pb = cam.p(J[b]); ctx.lineWidth = 2 * r * cam.zoom * H / pa[2] + off; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke(); });
    const ph = cam.p(J.head); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ph[0], ph[1], 0.115 * cam.zoom * H / ph[2] + off / 2, 0, 7); ctx.fill(); };
  ctx.save(); ctx.lineCap = 'round'; ctx.filter = 'blur(1.2px)'; draw('#25282c', 0); ctx.globalAlpha = 0.25; ctx.filter = 'blur(6px)'; draw('#ffffff', -10); ctx.restore();
  // depth-of-field haze
  const fog = ctx.createLinearGradient(0, 0, 0, H); fog.addColorStop(0, 'rgba(235,238,240,0.25)'); fog.addColorStop(1, 'rgba(235,238,240,0)'); ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H);
  // footprint cadence marks
  const a = ease(ramp(t, 0.15, 0.3));
  tag('BRADYKINESIA  ·  SHUFFLING GAIT', 120, 120, a, '40,60,75');
  text('short steps   ·   stooped posture   ·   reduced arm swing', 120, 178, 16, { align: 'left', a: a * 0.7, ls: 3, color: '60,70,80', w: 400 });
}
function sampleBody(J, density, seedBase) {
  SEED = seedBase; const pts = [];
  BONE3.forEach(([a, b, r], bi) => { const A = J[a], B = J[b]; const d = sub(B, A), Ln = len(d); const n = Math.ceil(Ln * TAU * r * density) + 20; const dir = mul(d, 1 / Ln);
    const e1 = norm(cross(dir, Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(dir, e1);
    for (let i = 0; i < n; i++) { const u = rnd(), th = rnd() * TAU; const nn = add(mul(e1, Math.cos(th)), mul(e2, Math.sin(th))); pts.push([add(add(A, mul(d, u)), mul(nn, r)), nn]); } });
  { const c = J.head; for (let i = 0; i < 700; i++) { const nn = norm([gauss(), gauss(), gauss()]); pts.push([add(c, mul(nn, 0.11)), nn]); } }
  return pts;
}
function sceneDepth(t, sec) {
  ctx.fillStyle = '#020304'; ctx.fillRect(0, 0, W, H);
  const J = walker(sec + 1.0, { F: [0, 0, 1], O: [0, 0, -5.6], T: 1.25, stride: 0.6 });
  const cam = camera([0.35, 1.25, 1.6], [0, 0.85, -2.5], 1.75);
  // floor points
  SEED = 5; for (let i = 0; i < 5000; i++) { const P = [(rnd() - 0.5) * 3.2, 0, -rnd() * 6.5]; const p = cam.p(P); if (p[2] < 0.3) continue; const c = turbo(1 - (p[2] - 1.0) / 6.5); ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.35)`; ctx.fillRect(p[0], p[1], 2, 2); }
  const pts = sampleBody(J, 9000, 11);
  const camDir = cam.f;
  pts.forEach(([P, nn]) => { if (dot(nn, sub(P, cam.pos)) > 0) return; const p = cam.p(P); const c = turbo(1 - (p[2] - 1.5) / 4.6); ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; const s = 2.6 / p[2] * 2; ctx.fillRect(p[0], p[1], s, s); });
  // skeleton overlay
  const sk = ease(ramp(t, 0.12, 0.3));
  ctx.save(); ctx.globalAlpha = sk; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
  BONE3.forEach(([a, b]) => { const pa = cam.p(J[a]), pb = cam.p(J[b]); ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke(); });
  Object.values(J).forEach(P => { const p = cam.p(P); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, 7); ctx.fill(); });
  ctx.restore();
  // footfall markers
  // metrics panel
  const a = ease(ramp(t, 0.25, 0.45)); const X = 1330, Y = 250;
  tag('DEPTH CAMERA  ·  3D GAIT ANALYSIS', 120, 110, ease(ramp(t, 0.05, 0.2)));
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(8,14,20,0.72)'; ctx.fillRect(X, Y, 470, 560); ctx.strokeStyle = 'rgba(57,198,232,0.35)'; ctx.strokeRect(X, Y, 470, 560); ctx.restore();
  const rows = [['GAIT SPEED', '0.48', 'm/s'], ['STRIDE LENGTH', '0.60', 'm'], ['CADENCE', '96', 'steps/min'], ['ARM SWING  L / R', '5° / 12°', ''], ['STEP-TIME VARIABILITY', '4.9', '%']];
  rows.forEach(([l, v, u], i) => { const k = ease(ramp(t, 0.3 + i * 0.06, 0.45 + i * 0.06)); text(l, X + 30, Y + 60 + i * 100, 14, { align: 'left', a: a * k * 0.7, ls: 4 });
    text(v, X + 30, Y + 104 + i * 100, 40, { align: 'left', a: a * k, w: 200 }); text(u, X + 230, Y + 108 + i * 100, 16, { align: 'left', a: a * k * 0.6, color: '57,198,232' }); });
  corner(90, 70, W - 180, H - 140, 0.5 * ease(ramp(t, 0, 0.15)));
  text('REC ● ' + (sec).toFixed(1) + ' s', W - 120, 110, 14, { align: 'right', a: 0.7, ls: 3, color: '255,120,110' });
}
// ---------- J. mmWave radar ----------
const RADAR_HAND = (() => { const fr = frame([0, 0, -1], [0, 1, 0], true);
  const h = buildHand({ W: [0, 0.25, 0.06], ...fr, s: 0.085, curls: [[0.08, 0.1, 0.05], [0.1, 0.12, 0.06], [0.12, 0.14, 0.08], [0.15, 0.15, 0.1], [0.1, 0.15, 0.1]], arm: norm([0.05, -0.12, 1]), armLen: 0.22 });
  SEED = 21; const pts = []; h.groups[0].caps.forEach(([A, ra, B, rb]) => { const d = sub(B, A), Ln = len(d); const n = Math.ceil(Ln * 9000) + 60; const dir = mul(d, 1 / Ln);
    const e1 = norm(cross(dir, Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(dir, e1);
    for (let i = 0; i < n; i++) { const u = rnd(), th = rnd() * TAU; const r = lerp(ra, rb, u); const nn = add(mul(e1, Math.cos(th)), mul(e2, Math.sin(th))); pts.push([add(add(A, mul(d, u)), mul(nn, r)), nn, A[2]]); } });
  return pts; })();
const SPEC = document.createElement('canvas'); SPEC.width = 400; SPEC.height = 200; const spg = SPEC.getContext('2d');
function sceneRadar(t, sec) {
  bgDark('#020406', '#09121a'); grid(0.03, 60);
  const ang = lerp(0.85, 0.35, easeIO(t));
  const cam = camera([Math.sin(ang) * 0.72 - 0.08, lerp(0.4, 0.34, t), Math.cos(ang) * 0.72], [-0.08, 0.15, -0.02], 1.3);
  // radar board
  const quad = (pts, fill, stroke) => { ctx.beginPath(); pts.forEach((P, i) => { const p = cam.p(P); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } };
  quad([[-0.05, 0, -0.04], [0.05, 0, -0.04], [0.05, 0, 0.04], [-0.05, 0, 0.04]], '#0d2a22', 'rgba(57,198,232,0.6)');
  for (let i = 0; i < 2; i++) quad([[-0.035 + i * 0.012, 0.001, -0.025], [-0.029 + i * 0.012, 0.001, -0.025], [-0.029 + i * 0.012, 0.001, -0.015], [-0.035 + i * 0.012, 0.001, -0.015]], '#d8a650');
  for (let i = 0; i < 4; i++) quad([[0.005 + i * 0.008, 0.001, -0.025], [0.01 + i * 0.008, 0.001, -0.025], [0.01 + i * 0.008, 0.001, -0.015], [0.005 + i * 0.008, 0.001, -0.015]], '#d8a650');
  quad([[-0.015, 0.002, 0.0], [0.015, 0.002, 0.0], [0.015, 0.002, 0.025], [-0.015, 0.002, 0.025]], '#111', 'rgba(255,255,255,0.3)');
  // wavefronts
  const O = cam.p([0, 0.003, -0.02]);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 7; k++) { const r = ((sec * 0.11 + k * 0.04) % 0.28); const a = (1 - r / 0.28) * 0.5 * ease(ramp(t, 0.05, 0.2));
    const rp = r * cam.zoom * H / O[2]; ctx.strokeStyle = `rgba(57,198,232,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(O[0], O[1], rp, rp * 0.92, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
  ctx.restore();
  // hand point cloud with tremor and micro-Doppler colouring
  const disp = 0.004 * Math.sin(sec * TAU * 5.2), vel = Math.cos(sec * TAU * 5.2);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  RADAR_HAND.forEach(([P, nn, z0]) => { const w = clamp((P[2] - 0.0) / 0.25); const fade = 1 - ease(ramp(P[2], 0.12, 0.27)); if (fade <= 0) return;
    const off = disp * (0.4 + 0.6 * (1 - w)); const p = cam.p([P[0], P[1] + off, P[2]]);
    const lit = 0.35 + 0.65 * Math.max(0, -nn[1]);
    const c = vel * (1 - w) > 0 ? [255, 120 + 60 * (1 - Math.abs(vel)), 90] : [80, 170, 255];
    const mix2 = Math.abs(vel) * (1 - w) * ease(ramp(t, 0.25, 0.45)); const base = [120, 200, 235];
    const col = base.map((b, i) => lerp(b, c[i], mix2) | 0);
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.45 * lit * fade})`; const s = 1.7 / p[2] * 0.7; ctx.fillRect(p[0], p[1], s, s); });
  ctx.restore();
  // beam lines to hand
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; SEED = 41;
  for (let i = 0; i < 26; i++) { const P = RADAR_HAND[Math.floor(rnd() * RADAR_HAND.length)][0]; if (P[2] > 0.08 || P[1] > 0.26) continue; const p = cam.p([P[0], P[1] + disp, P[2]]);
    const a = 0.12 * (0.5 + 0.5 * Math.sin(sec * 8 + i)) * ease(ramp(t, 0.1, 0.3)); ctx.strokeStyle = `rgba(57,198,232,${a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(O[0], O[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
  ctx.restore();
  // micro-Doppler spectrogram panel
  const a = ease(ramp(t, 0.3, 0.5)); const X = 1250, Y = 230, PW = 560, PH = 280;
  spg.drawImage(SPEC, -2, 0); for (let y = 0; y < 200; y++) { const f = (200 - y) / 200 * 20; let v = Math.exp(-Math.pow((f - 5.2) / 0.5, 2)) + 0.35 * Math.exp(-Math.pow((f - 10.4) / 0.6, 2)) + 0.1 * Math.random();
    v *= 0.7 + 0.3 * Math.sin(sec * 3); const c = turbo(clamp(v)); spg.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; spg.fillRect(398, y, 2, 1); }
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,12,18,0.75)'; ctx.fillRect(X, Y, PW, PH + 300); ctx.strokeStyle = 'rgba(57,198,232,0.35)'; ctx.strokeRect(X, Y, PW, PH + 300);
  ctx.drawImage(SPEC, X + 30, Y + 50, PW - 60, PH - 80); ctx.restore();
  text('MICRO-DOPPLER SPECTRUM', X + 30, Y + 28, 13, { align: 'left', a: a * 0.75, ls: 4 }); text('20 Hz', X + PW - 30, Y + 58, 11, { align: 'right', a: a * 0.5 }); text('0', X + PW - 30, Y + PH - 36, 11, { align: 'right', a: a * 0.5 });
  ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); for (let i = 0; i <= PW - 60; i += 2) { const tt = sec - (PW - 60 - i) / 260; const v = Math.sin(tt * TAU * 5.2) + 0.15 * Math.sin(tt * 61); const y = Y + PH + 70 - v * 40; i ? ctx.lineTo(X + 30 + i, y) : ctx.moveTo(X + 30 + i, y); }
  ctx.strokeStyle = '#7fe3a0'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  text('DISPLACEMENT', X + 30, Y + PH + 10, 13, { align: 'left', a: a * 0.75, ls: 4 });
  text('5.2 Hz', X + 30, Y + PH + 190, 46, { align: 'left', a, w: 200 }); text('0.86 mm', X + 290, Y + PH + 190, 46, { align: 'left', a, w: 200 });
  text('FREQUENCY', X + 30, Y + PH + 235, 12, { align: 'left', a: a * 0.6, ls: 4, color: '57,198,232' }); text('AMPLITUDE', X + 290, Y + PH + 235, 12, { align: 'left', a: a * 0.6, ls: 4, color: '57,198,232' });
  tag('mmWAVE RADAR  ·  CONTACTLESS TREMOR SENSING', 120, 110, ease(ramp(t, 0.05, 0.2)));
}
// ---------- I. UPDRS sheet ----------
const ITEMS = ['Speech', 'Facial expression', 'Rigidity', 'Finger tapping', 'Hand movements', 'Pronation-supination', 'Toe tapping', 'Leg agility', 'Arising from chair', 'Gait', 'Freezing of gait', 'Postural stability', 'Posture', 'Body bradykinesia', 'Postural tremor', 'Kinetic tremor', 'Rest tremor amplitude', 'Constancy of rest tremor'];
const RA = [1, 2, 2, 2, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 1, 1, 2, 3], RB = [1, 1, 2, 3, 2, 2, 1, 2, 1, 3, 1, 2, 2, 2, 2, 1, 3, 3];
function sceneUpdrs(t, sec) {
  bgDark('#05070a', '#0d141b'); grid(0.025);
  tag('MDS-UPDRS PART III  ·  MOTOR EXAMINATION', 120, 100, ease(ramp(t, 0.0, 0.1)));
  const X = 120, Y = 170, RH2 = 44;
  ITEMS.forEach((name, i) => { const k = ease(ramp(t, 0.02 + i * 0.012, 0.12 + i * 0.012)); const col = i % 2 ? 0 : 1; const x = X + (i >= 9 ? 560 : 0), y = Y + (i % 9) * RH2 * 1.7;
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(x, y, 520, RH2 * 1.45); ctx.restore();
    text('3.' + (i + 1), x + 18, y + 33, 15, { align: 'left', a: k * 0.6, ls: 1, color: '57,198,232', w: 500 }); text(name, x + 78, y + 33, 18, { align: 'left', a: k * 0.9, w: 300 });
    const sa = ease(ramp(t, 0.3 + i * 0.012, 0.36 + i * 0.012)), sb = ease(ramp(t, 0.42 + i * 0.012, 0.48 + i * 0.012)); const diff = RA[i] !== RB[i];
    text(RA[i] + '', x + 420, y + 33, 22, { a: sa, w: 300 }); text(RB[i] + '', x + 480, y + 33, 22, { a: sb, w: 300, color: diff && t > 0.62 ? '255,170,90' : '255,255,255' });
    if (diff && t > 0.62) { ctx.save(); ctx.globalAlpha = ease(ramp(t, 0.62, 0.7)); ctx.strokeStyle = 'rgba(255,170,90,0.8)'; ctx.strokeRect(x + 395, y + 6, 110, RH2 * 1.45 - 12); ctx.restore(); }
  });
  text('RATER A', X + 420, Y - 22, 12, { a: ease(ramp(t, 0.3, 0.36)) * 0.6, ls: 3 }); text('RATER B', X + 480, Y - 22, 12, { a: ease(ramp(t, 0.42, 0.48)) * 0.6, ls: 3 });
  text('RATER A', X + 980, Y - 22, 12, { a: ease(ramp(t, 0.3, 0.36)) * 0.6, ls: 3 }); text('RATER B', X + 1040, Y - 22, 12, { a: ease(ramp(t, 0.42, 0.48)) * 0.6, ls: 3 });
  // timeline of visits with unobserved fluctuation
  const a = ease(ramp(t, 0.66, 0.78)); const TX = 1290, TY = 640, TW = 520;
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(TX, TY); ctx.lineTo(TX + TW, TY); ctx.stroke();
  ctx.beginPath(); for (let i = 0; i <= TW; i += 3) { const v = Math.sin(i / 23) * 26 + Math.sin(i / 7.3) * 9 + Math.sin(i / 61) * 22; i ? ctx.lineTo(TX + i, TY - 120 - v) : ctx.moveTo(TX + i, TY - 120 - v); }
  ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(255,170,90,0.6)'; ctx.stroke(); ctx.setLineDash([]);
  [0, 0.5, 1].forEach((f, i) => { const x = TX + f * TW; ctx.fillStyle = '#39c6e8'; ctx.beginPath(); ctx.arc(x, TY, 7, 0, 7); ctx.fill(); text(['MONTH 0', 'MONTH 3', 'MONTH 6'][i], x, TY + 32, 13, { a: 0.7, ls: 3 }); });
  ctx.restore();
  text('UNOBSERVED BETWEEN VISITS', TX, TY - 205, 13, { align: 'left', a: a * 0.8, ls: 4, color: '255,170,90' });
  const b = ease(ramp(t, 0.8, 0.9)); text('SUBJECTIVE   ·   EPISODIC   ·   RATER-DEPENDENT', W / 2, H - 80, 22, { a: b, ls: 10, w: 400 });
}
// ---------- L. end ----------
function sceneEnd(t, sec) {
  bgDark('#020305', '#0a1117');
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) { const y0 = H / 2 + (i - 45) * 9; const k = easeIO(ramp(t, 0.0, 0.5)); const y = lerp(y0, H / 2, k * 0.9);
    ctx.strokeStyle = `rgba(57,198,232,${0.06 + 0.1 * (1 - Math.abs(i - 45) / 45)})`; ctx.beginPath();
    for (let x = 0; x <= W; x += 12) { const amp = (1 - k) * 18 * Math.sin(i * 0.7); const yy = y + Math.sin(x / 90 + sec * 2 + i) * amp; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
  ctx.restore();
  const a = ease(ramp(t, 0.3, 0.5)), b = ease(ramp(t, 0.5, 0.7));
  text('FROM SUBJECTIVE SCORES', W / 2, H / 2 - 70, 52, { a, w: 200, ls: 12 }); text('TO OBJECTIVE DATA', W / 2, H / 2, 52, { a, w: 200, ls: 12 });
  text('CONTACTLESS   ·   CONTINUOUS   ·   QUANTIFIED', W / 2, H / 2 + 90, 20, { a: b * 0.85, w: 400, ls: 10, color: '57,198,232' });
}

// ---------- WebGL shots (cup, pen, finger tapping) ----------
function tapHand(gsec, t) {
  // MDS-UPDRS 3.4: index taps thumb; amplitude decrement + hesitation
  const fr = frame([0.08, 1, 0.1], [0.35, 0, -1], true);
  const f = 2.1, ph = gsec * TAU * f + (gsec > 1.9 && gsec < 2.25 ? -Math.sin((gsec - 1.9) / 0.35 * Math.PI) * 1.2 : 0);
  const dec = lerp(1, 0.45, ease(ramp(t, 0.1, 0.9)));
  const close = 1 - (0.5 + 0.5 * Math.cos(ph)) * dec;
  const idx = lerp3([0.15, 0.15, 0.08], [0.85, 0.75, 0.45], close), th = lerp3([0.0, 0.05, 0.05], [0.3, 0.3, 0.2], close);
  const curls = [idx, [1.45, 1.55, 0.95], [1.5, 1.6, 0.95], [1.5, 1.55, 0.9], th];
  const tr = 0.04 * Math.sin(gsec * TAU * 5);
  return buildHand({ W: [0, 18.6 + tr * 0.1, 0], ...fr, s: HS, curls, thumbDir: [0.85, 0.5, -0.35], arm: norm([0.06, -1, 0.3]), armLen: 9, sleeve: 1.6, sleeveR: 0.42, skin: SKIN_P, sleeveMat: KNIT }).groups;
}
function glParams(k, t, sec, gsec) {
  const u = { t: gsec };
  if (k === 'cup') { const c = cupHand(gsec, 0.05);
    Object.assign(u, { scene: 2, bound: B_HOME, key: 1, rip: 0.02 + 0.008 * Math.sin(gsec * 3), cup: c.cup, groups: c.groups, ro: lerp3([8.2, 3.4, 8.4], [7.2, 3.2, 7.4], easeIO(t)), ta: [1.0, 1.8, 0.2], zoom: 1.7, aper: 10, expo: 1.05, ss: 1.0 });
    u.focus = dist(u.ro, [1.0, 2.0, 0.8]); }
  if (k === 'pen') { const n = Math.floor(SPIRAL.length * lerp(0.25, 0.95, easeIO(t))); drawPaper(n); uploadCanvas(1, tPap, papC); const ph = penHand(gsec, n);
    Object.assign(u, { scene: 3, bound: [ph.tip[0] + 1.5, 1.5, ph.tip[2] + 1.0, 9.0], key: 1, groups: ph.groups, pen0: ph.pen0, pen1: ph.pen1, ro: lerp3([-7.0, 6.2, 8.8], [-6.0, 5.6, 7.8], easeIO(t)), ta: [0.6, 1.0, 0.6], zoom: 1.55, aper: 12, expo: 1.0, ss: 1.0 });
    u.focus = dist(u.ro, ph.tip); }
  if (k === 'tap') { ui('off', 0, 0, 0); uploadCanvas(0, tScr, scrC);
    Object.assign(u, { scene: 1, noTower: 1, bound: [0, 19.6, 0.6, 5.5], key: 1, expo: 0.82, groups: tapHand(gsec, t), ro: lerp3([8.2, 21.8, 6.4], [7.2, 21.4, 5.8], easeIO(t)), ta: [0.1, 20.7, 0], zoom: 1.55, aper: 20, ss: 1.0 });
    u.focus = dist(u.ro, [0.1, 20.4, 0.2]); }
  return u;
}
const B_HOME = [3.0, 1.2, -2.0, 11.5];
const dist = (a, b) => len(sub(a, b));
function tapOverlay(t, sec) {
  const a = ease(ramp(t, 0.08, 0.2));
  tag('MDS-UPDRS PART III  ·  3.4 FINGER TAPPING', 120, 110, a, '255,255,255');
  text('"Tap the index finger on the thumb 10 times, as quickly and as big as possible."', 120, 170, 17, { align: 'left', a: a * 0.75, w: 400, ls: 1 });
  const X = 120, Y = H - 190; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(10,14,18,0.55)'; ctx.fillRect(X - 20, Y - 50, 640, 140); ctx.restore();
  ['0 NORMAL', '1 SLIGHT', '2 MILD', '3 MODERATE', '4 SEVERE'].forEach((s, i) => { text(s, X + i * 124, Y + 40, 14, { align: 'left', a: a * 0.8, ls: 2 }); });
  const cur = 2 + 0.5 + 0.5 * Math.sin(sec * 1.6) * ease(ramp(t, 0.3, 0.5)) - 0.5; const cx = X + cur * 124 + 20;
  ctx.save(); ctx.globalAlpha = a * ease(ramp(t, 0.25, 0.4)); ctx.fillStyle = '#ffaa5a'; ctx.beginPath(); ctx.moveTo(cx, Y + 8); ctx.lineTo(cx - 9, Y - 6); ctx.lineTo(cx + 9, Y - 6); ctx.fill(); ctx.restore();
  text('SCORE ?', X, Y - 24, 14, { align: 'left', a: a * ease(ramp(t, 0.25, 0.4)), ls: 4, color: '255,170,90' });
}
const SYM = { cup: ['REST TREMOR', 'tremor at 4–6 Hz, most visible at rest'], pen: ['TREMOR  ·  MICROGRAPHIA', 'handwriting becomes small and irregular'] };

async function renderFrame(fr) {
  const s = SHOTS.find(x => fr >= x.f0 && fr < x.f0 + x.n); const lf = fr - s.f0, t = lf / (s.n - 1), sec = lf / FPS, gsec = fr / FPS, k = s.k;
  const FIN = { numbers: 12, title: 8, brain: 10, neurons: 8, cup: 8, pen: 5, gait: 5, tap: 8, updrs: 6, radar: 10, depth: 8, end: 8 }, FOUT = { numbers: 10, brain: 6, neurons: 10, gait: 6, updrs: 10, depth: 8, end: 20 };
  let fade = 1; if (FIN[k]) fade = Math.min(fade, (lf + 1) / FIN[k]); if (FOUT[k]) fade = Math.min(fade, (s.n - lf - 1) / FOUT[k]); fade = clamp(fade);
  if (k === 'cup' || k === 'pen' || k === 'tap') {
    const u = glParams(k, t, sec, gsec); await drawGL(u); ctx.drawImage(glc, 0, 0); bloom(k === 'tap' ? 0.1 : 0.22);
    if (SYM[k]) { const a = ease(ramp(t, 0.15, 0.3)); tag(SYM[k][0], 120, 110, a, '255,255,255'); text(SYM[k][1], 120, 168, 16, { align: 'left', a: a * 0.7, ls: 3, w: 400 }); }
    if (k === 'tap') tapOverlay(t, sec);
  } else {
    ({ numbers: sceneNumbers, title: sceneTitle, brain: sceneBrain, neurons: sceneNeurons, gait: sceneGait, updrs: sceneUpdrs, radar: sceneRadar, depth: sceneDepth, end: sceneEnd })[k](t, sec);
    if (k !== 'gait') bloom(0.22);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  finish(fr, fade);
}

// ---------- audio (music + sound design, leaves room for voice-over) ----------
async function makeAudio() {
  const SR = 48000, LEN = 75, ac = new OfflineAudioContext(2, SR * LEN, SR);
  const master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
  const rev = ac.createConvolver(); { const n = SR * 4, b = ac.createBuffer(2, n, SR); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); } rev.buffer = b; }
  const rg = ac.createGain(); rg.gain.value = 0.4; rev.connect(rg).connect(master);
  const bus = (g = 1) => { const n = ac.createGain(); n.gain.value = g; n.connect(master); n.connect(rev); return n; };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const nb = (() => { const b = ac.createBuffer(1, SR * 2, SR), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const pad = (t0, t1, notes, v, at = 2, rel = 2.5, cut = 1000) => { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut; const g = ac.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + at); g.gain.setValueAtTime(v, t1); g.gain.linearRampToValueAtTime(0, t1 + rel); lp.connect(g).connect(bus());
    notes.forEach((m, i) => [-7, 7].forEach(dt => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt + i; const og = ac.createGain(); og.gain.value = 0.04; o.connect(og).connect(lp); o.start(t0); o.stop(t1 + rel + 0.1); })); };
  const pluck = (t, m, v = 0.08, d = 1.4) => { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(bus()); o.start(t); o.stop(t + d); };
  const piano = (t, m, v = 0.12, dur = 3.5) => [[1, 1], [2, 0.35], [3, 0.12]].forEach(([h, a]) => { const o = ac.createOscillator(); o.frequency.value = mtof(m) * h; const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * a, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur / h); o.connect(g).connect(bus()); o.start(t); o.stop(t + dur); });
  const hit = (t, v = 0.6) => { const o = ac.createOscillator(); o.frequency.setValueAtTime(65, t); o.frequency.exponentialRampToValueAtTime(30, t + 1.5); const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 2.4); o.connect(g).connect(master); o.start(t); o.stop(t + 2.5); };
  const whoosh = (t, d, f0, f1, v) => { const s = ac.createBufferSource(); s.buffer = nb; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + d);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + d * 0.7); g.gain.linearRampToValueAtTime(0, t + d); s.connect(f).connect(g).connect(bus(0.8)); s.start(t); s.stop(t + d + 0.05); };
  const tick = (t, f = 4000, v = 0.04) => { const s = ac.createBufferSource(); s.buffer = nb; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 5; const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); s.connect(bp).connect(g).connect(bus()); s.start(t); s.stop(t + 0.05); };
  // 0-9 data pulse
  pad(0.2, 8.6, [45, 52, 57, 64], 0.08, 3, 1.5, 700); for (let i = 0; i < 34; i++) tick(0.5 + i * 0.25, 3000 + (i % 4) * 600, 0.03);
  [0.5, 2.5, 4.5, 6.5].forEach((t, i) => pluck(t, [69, 72, 76, 81][i], 0.06, 2));
  hit(9.0, 0.55); whoosh(8.2, 0.9, 400, 6000, 0.12);
  pad(9.0, 13.6, [41, 48, 57, 64, 69], 0.1, 1.5, 1.5, 900); piano(9.1, 69, 0.1, 5);
  // brain & neurons: deep, slightly dissonant as neurons die
  pad(14.0, 19.6, [40, 47, 55, 62], 0.1, 2, 1.2, 800); pad(20.0, 25.6, [40, 46, 55, 61], 0.1, 1.5, 1.6, 650);
  for (let i = 0; i < 14; i++) pluck(20.2 + i * 0.4, 76 + (i % 3) * 3, 0.05 * (1 - i / 14), 1.2);
  // symptoms: sparse piano (A minor)
  [[26.1, 69], [27.6, 72], [29.1, 76], [31.1, 74], [32.6, 72], [34.1, 69], [36.1, 67], [37.6, 69], [39.1, 64]].forEach(([t, m]) => piano(t, m, 0.1, 4));
  pad(26.0, 40.6, [45, 57, 64], 0.08, 2, 1.2, 800);
  // clinic & UPDRS: clock-like pulse, tension
  pad(41.0, 52.6, [43, 50, 58, 62], 0.09, 1.5, 1.4, 900); for (let i = 0; i < 46; i++) tick(41.2 + i * 0.25, i % 4 ? 2500 : 1600, i % 4 ? 0.025 : 0.05);
  // solution: lift
  whoosh(52.0, 1.1, 300, 7000, 0.14); hit(53.0, 0.6);
  const prog = [[53, [45, 57, 64, 71, 76]], [57, [41, 57, 65, 72, 77]], [61, [48, 55, 64, 72, 79]], [65, [43, 55, 62, 71, 74]], [69, [45, 57, 64, 69, 76]]];
  prog.forEach(([t, ch], i) => { const nx = (prog[i + 1] || [74.3])[0]; pad(t, nx - 0.2, ch, 0.11, 1, 1.4, 1400); for (let b = 0; b < (nx - t) / 0.5; b++) pluck(t + b * 0.5, ch[2 + (b % 3)] + 12, 0.035, 0.8); });
  for (let i = 0; i < 30; i++) tick(53.5 + i * 0.5, 5200, 0.02);
  hit(69.0, 0.45); piano(69.1, 81, 0.07, 5);
  master.gain.setValueAtTime(0.7, 72.5); master.gain.linearRampToValueAtTime(0, 75);
  const buf = await ac.startRendering(); const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let pk = 0; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); const gn = 0.8 / pk;
  const pcm = new Int16Array(L.length * 2); for (let i = 0; i < L.length; i++) { pcm[2 * i] = clamp(L[i] * gn, -1, 1) * 32767; pcm[2 * i + 1] = clamp(R[i] * gn, -1, 1) * 32767; }
  return new Uint8Array(pcm.buffer);
}

// ---------- driver ----------
window.state = { frame: 0, done: false, err: null, t0: 0 };
window.preview = async fr => { await renderFrame(fr); };
window.run = async (from = 0, to = TOTAL) => {
  try {
    state.t0 = performance.now(); const samples = []; let avcC = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC) avcC = new Uint8Array(meta.decoderConfig.description);
      const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); samples.push({ data: d, key: chunk.type === 'key', ts: chunk.timestamp }); }, error: e => state.err = String(e) });
    enc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 14_000_000, framerate: FPS, avc: { format: 'avc' }, latencyMode: 'quality' });
    state.audio = makeAudio(); state.samples = samples;
    for (let fr = from; fr < to; fr++) { state.frame = fr; await renderFrame(fr);
      const vf = new VideoFrame(out, { timestamp: Math.round(fr * 1e6 / FPS), duration: Math.round(1e6 / FPS) }); enc.encode(vf, { keyFrame: fr % 50 === 0 }); vf.close();
      while (enc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 5)); }
    await enc.flush(); enc.close(); samples.sort((a, b) => a.ts - b.ts);
    const pcm = await state.audio; Object.assign(state, { samples, avcC, pcm, W, H, DUR: DUR_MS });
    state.blob = buildMov(samples, avcC, pcm); state.wav = wav(pcm); state.done = true; state.secs = (performance.now() - state.t0) / 1000;
  } catch (e) { state.err = e.stack || String(e); }
};
document.getElementById('log').textContent = 'ready';
