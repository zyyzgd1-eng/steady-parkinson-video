// 60s product film renderer: WebGL raymarch + 2D compositing + WebCodecs H.264 + PCM audio -> QuickTime .mov
const W = 1920, H = 1080, FPS = 25, TOTAL = 1500;
const NAME = 'STEADY';
const TAG = 'WEARABLE TREMOR CARE';
const SLOGAN = 'STEADY, EVERY MOMENT';

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeIO = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };

// ---------- GL setup ----------
const glc = document.createElement('canvas'); glc.width = W; glc.height = H;
const gl = glc.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
const vs = `#version 300 es
in vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;
function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, document.getElementById('fs').textContent.trim()));
gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = {}; ['uRes', 'uRo', 'uTa', 'uZoom', 'uT', 'uScene', 'uExplode', 'uLed', 'uRimX', 'uSweep', 'uRim', 'uKey', 'uFloor', 'uSpin', 'uRip', 'uDevice', 'uCup', 'uBound']
  .forEach(n => U[n] = gl.getUniformLocation(prog, n));

async function drawGL(s) {
  gl.viewport(0, 0, W, H);
  gl.uniform2f(U.uRes, W, H);
  gl.uniform3fv(U.uRo, s.ro); gl.uniform3fv(U.uTa, s.ta); gl.uniform1f(U.uZoom, s.zoom);
  gl.uniform1f(U.uT, s.t || 0); gl.uniform1i(U.uScene, s.scene);
  gl.uniform1f(U.uExplode, s.explode || 0); gl.uniform1f(U.uLed, s.led || 0);
  gl.uniform1f(U.uRimX, s.rimX || 0); gl.uniform1f(U.uSweep, s.sweep || 0);
  gl.uniform1f(U.uRim, s.rim ?? 1); gl.uniform1f(U.uKey, s.key ?? 1); gl.uniform1f(U.uFloor, s.floor || 0);
  gl.uniform1f(U.uSpin, s.spin || 0); gl.uniform1f(U.uRip, s.rip || 0); gl.uniform1f(U.uDevice, s.device || 0);
  gl.uniform3fv(U.uCup, s.cup || [0, 0, 0]); gl.uniform4fv(U.uBound, s.bound);
  gl.enable(gl.SCISSOR_TEST);
  const STR = 12, h = H / STR;
  for (let i = 0; i < STR; i++) {
    gl.scissor(0, i * h, W, h); gl.drawArrays(gl.TRIANGLES, 0, 3);
    const px = new Uint8Array(4); gl.readPixels(0, i * h, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    await new Promise(r => setTimeout(r, 0));
  }
  gl.disable(gl.SCISSOR_TEST);
}
function project(s, P) {
  const f = norm(sub(s.ta, s.ro)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), d = sub(P, s.ro);
  const z = dot(d, f); return [W / 2 + dot(d, r) / z * s.zoom * H, H / 2 - dot(d, u) / z * s.zoom * H];
}

// ---------- 2D canvases ----------
const out = document.getElementById('out'); out.width = W; out.height = H;
const ctx = out.getContext('2d');
const small = document.createElement('canvas'); small.width = W / 4; small.height = H / 4; const sctx = small.getContext('2d');
const grain = document.createElement('canvas'); grain.width = grain.height = 256;
{ const g = grain.getContext('2d'), id = g.createImageData(256, 256); let seed = 7;
  for (let i = 0; i < id.data.length; i += 4) { seed = (seed * 16807) % 2147483647; const v = seed % 256; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  g.putImageData(id, 0, 0); }
const FONT = '"Noto Sans", sans-serif';
function text(str, x, y, size, { w = 300, a = 1, ls = 0, align = 'center', color = '255,255,255' } = {}) {
  ctx.save(); ctx.font = `${w} ${size}px ${FONT}`; ctx.letterSpacing = ls + 'px'; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(${color},${a})`; ctx.fillText(str, x + (align === 'center' ? ls / 2 : 0), y); ctx.restore();
}
function bloom(amount) {
  sctx.filter = 'brightness(0.62) contrast(3.4) blur(6px)'; sctx.clearRect(0, 0, W / 4, H / 4); sctx.drawImage(out, 0, 0, W / 4, H / 4);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = amount; ctx.filter = 'blur(10px)'; ctx.drawImage(small, 0, 0, W, H); ctx.restore();
}
function finish(fr, fade) {
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = 0.035; ctx.globalCompositeOperation = 'overlay';
  const ox = (fr * 73) % 256, oy = (fr * 151) % 256; ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
  if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fade})`; ctx.fillRect(0, 0, W, H); }
}
function depthBlur(top, bottom, px) {
  // fake shallow depth of field: blur bands at top / bottom of frame
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const t = tmp.getContext('2d');
  t.filter = `blur(${px}px)`; t.drawImage(out, 0, 0);
  t.filter = 'none'; t.globalCompositeOperation = 'destination-in';
  const g = t.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(0,0,0,${top})`); g.addColorStop(0.42, 'rgba(0,0,0,0)'); g.addColorStop(0.62, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${bottom})`);
  t.fillStyle = g; t.fillRect(0, 0, W, H); ctx.drawImage(tmp, 0, 0);
}

// ---------- shots ----------
const BOUND_A = [0, -2.0, 0, 3.6], BOUND_E = [0, -1.0, 0, 6.6], BOUND_W = [1.0, 1.8, 0.4, 3.9];
const shots = [
  { d: 4, k: 'title' }, { d: 5, k: 'cup' }, { d: 4, k: 'spiral' }, { d: 3, k: 'ripple' },
  { d: 5, k: 'reveal' }, { d: 4, k: 'macro' }, { d: 5, k: 'hero' }, { d: 6, k: 'explode' },
  { d: 5, k: 'sensor' }, { d: 5, k: 'ai' }, { d: 4, k: 'assemble' }, { d: 5, k: 'cupStill' },
  { d: 3, k: 'app' }, { d: 2, k: 'end' }];
{ let a = 0; shots.forEach(s => { s.f0 = a; s.n = s.d * FPS; a += s.n; }); }

function cupJitter(t, amp) {
  return [amp * (Math.sin(t * 2 * Math.PI * 5.2) * 0.7 + Math.sin(t * 2 * Math.PI * 3.1 + 1) * 0.3), amp * 0.5 * Math.sin(t * 2 * Math.PI * 4.4 + 2), amp * 0.35 * Math.sin(t * 2 * Math.PI * 5.2 + 0.4)];
}
const CAM = {
  reveal: (t) => ({ ro: lerp3([3.8, 2.4, 13.4], [2.9, 1.8, 10.6], easeIO(t)), ta: [0, -1.9, 0], zoom: 1.45 }),
  macro: (t) => ({ ro: lerp3([-2.6, 1.55, 3.4], [0.9, 1.45, 3.6], easeIO(t)), ta: lerp3([-1.1, 0.45, 0.5], [0.9, 0.4, 0.6], easeIO(t)), zoom: 2.4 }),
  hero: () => ({ ro: [7.2, 3.3, 9.8], ta: [0, -2.0, 0], zoom: 1.6 }),
  explode: (t) => { const a = lerp(0.42, 0.72, easeIO(t)); return { ro: [Math.sin(a) * 15.5, 4.2, Math.cos(a) * 15.5], ta: [0, lerp(-1.6, -1.0, easeIO(ramp(t, 0.05, 0.7))), 0], zoom: lerp(1.6, 1.12, easeIO(ramp(t, 0.05, 0.7))) }; },
  sensor: (t) => { const a = 0.72, s = { ro: [Math.sin(a) * 15.5, 4.2, Math.cos(a) * 15.5], ta: [0, -1.1, 0] };
    s.ta = [0, -1.0, 0]; const k = easeIO(ramp(t, 0, 0.85)); return { ro: lerp3(s.ro, [1.9, 1.45, 2.7], k), ta: lerp3(s.ta, [-0.35, 0.94, 0.15], k), zoom: lerp(1.12, 2.5, k) }; },
  assemble: (t) => { const k = easeIO(ramp(t, 0.05, 0.62)); return { ro: lerp3([6.6, 3.4, 11.5], [7.0, 3.2, 12.0], easeIO(t)), ta: [0, lerp(-1.0, -1.9, k), 0], zoom: lerp(1.0, 1.5, k) }; },
  end: (t) => ({ ro: lerp3([3.4, 1.2, 14.2], [3.3, 1.2, 13.8], t), ta: [3.1, -2.1, 0], zoom: 1.5 }),
  cup: (t) => ({ ro: lerp3([0.7, 2.25, 9.6], [0.45, 2.1, 8.2], easeIO(t)), ta: [0.25, 1.85, 0], zoom: 1.95 }),
  cupStill: (t) => ({ ro: lerp3([1.7, 2.5, 10.8], [1.5, 2.35, 9.7], easeIO(t)), ta: [1.35, 1.55, 0.4], zoom: 1.75 }),
};

// 2D-only shots
function drawTitle(t, sec) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const n = Math.floor(10000000 * easeIO(ramp(t, 0.05, 0.6)));
  const a = ease(ramp(t, 0.02, 0.2)) * (1 - ease(ramp(t, 0.9, 1)));
  text(n.toLocaleString('en-US') + (t > 0.6 ? '+' : ''), W / 2, H / 2 - 30, 128, { w: 200, a, ls: 6 });
  ctx.fillStyle = `rgba(57,198,232,${a * 0.9})`; ctx.fillRect(W / 2 - 180 * ease(ramp(t, 0.3, 0.7)), H / 2 + 60, 360 * ease(ramp(t, 0.3, 0.7)), 1.5);
  text("PEOPLE LIVE WITH PARKINSON'S", W / 2, H / 2 + 110, 26, { w: 300, a: a * ease(ramp(t, 0.45, 0.65)), ls: 10, color: '200,210,220' });
}
function spiralPts(n, jit) {
  const pts = []; for (let i = 0; i <= n; i++) { const a = i / 40; const r = 8 + a * 26;
    const j = jit * (Math.sin(i * 0.9) * 6 + Math.sin(i * 0.37 + 1) * 5 + Math.sin(i * 2.1) * 2.5);
    pts.push([Math.cos(a) * (r + j), Math.sin(a) * (r + j * 0.8)]); } return pts;
}
const SP = spiralPts(760, 1);
function drawSpiral(t) {
  ctx.save();
  const g = ctx.createRadialGradient(W * 0.38, H * 0.3, 100, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, '#efe6d6'); g.addColorStop(1, '#6d5a43'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.06; ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  const sc = lerp(1.15, 1.32, easeIO(t)); ctx.translate(W / 2 + lerp(30, -20, t), H / 2 + lerp(20, -10, t)); ctx.scale(sc, sc); ctx.rotate(-0.08);
  const n = Math.floor(SP.length * easeIO(ramp(t, 0.03, 0.92)));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath(); SP.slice(0, n).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = pass ? 'rgba(20,24,38,0.88)' : 'rgba(20,24,38,0.18)'; ctx.lineWidth = pass ? 2.6 : 5; ctx.stroke();
  }
  if (n > 1) { // pen
    const p = SP[n - 1], wob = Math.sin(t * 60) * 0.03;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-0.75 + wob);
    ctx.fillStyle = 'rgba(40,25,10,0.22)'; ctx.beginPath(); ctx.ellipse(70, 40, 260, 16, 0.18, 0, 7); ctx.fill();
    const pg = ctx.createLinearGradient(0, -14, 0, 14); pg.addColorStop(0, '#30343c'); pg.addColorStop(0.45, '#8a909a'); pg.addColorStop(1, '#16181c');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(34, -9); ctx.lineTo(560, -13); ctx.lineTo(560, 13); ctx.lineTo(34, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9ccd1'; ctx.fillRect(34, -10, 26, 20); ctx.restore();
  }
  ctx.restore();
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H); v.addColorStop(0, 'rgba(30,18,6,0)'); v.addColorStop(1, 'rgba(30,18,6,0.5)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
function drawRipple(t, sec) {
  ctx.fillStyle = '#020406'; ctx.fillRect(0, 0, W, H);
  const k = easeIO(ramp(t, 0.25, 0.8));
  ctx.save(); ctx.translate(W / 2, H / 2);
  ctx.strokeStyle = '#39c6e8'; ctx.shadowColor = '#39c6e8'; ctx.shadowBlur = 18;
  for (let i = 0; i < 7; i++) {
    const r = ((sec * 140 + i * 110) % 770) + 10, a = (1 - r / 780) * 0.8;
    ctx.globalAlpha = a; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let s = 0; s <= 200; s++) { const th = s / 200 * Math.PI * 2;
      const x = Math.cos(th) * r * lerp(1, 2.6, k), y = Math.sin(th) * r * lerp(0.42, 0.0, k) + (k > 0 ? Math.sin(th * 8 + sec * 9) * 24 * k * (1 - r / 800) : 0);
      s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.restore();
  // converge into single wave line
  const w = ease(ramp(t, 0.6, 0.95));
  if (w > 0) {
    ctx.save(); ctx.globalAlpha = w; ctx.strokeStyle = '#bff0ff'; ctx.shadowColor = '#39c6e8'; ctx.shadowBlur = 24; ctx.lineWidth = 2.5;
    ctx.beginPath(); for (let x = 0; x <= W; x += 4) { const env = Math.exp(-((x - W / 2) ** 2) / 2.2e5); const y = H / 2 + Math.sin(x / 26 - sec * 8) * 110 * env * (1 - 0.6 * w * ramp(t, 0.85, 1)); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
  }
}
const HAND = (() => { // 21 keypoints of an open right hand (MediaPipe order), pixel coords
  const P = [[0, 0], [-70, -40], [-120, -95], [-150, -150], [-175, -195], [-55, -175], [-65, -260], [-70, -315], [-73, -360],
    [0, -185], [0, -280], [0, -340], [0, -390], [50, -175], [62, -262], [68, -318], [72, -362], [95, -150], [118, -220], [130, -265], [140, -305]];
  return P;
})();
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
function drawAI(t, sec) {
  ctx.fillStyle = '#07090c'; ctx.fillRect(0, 0, W, H);
  // grid
  ctx.strokeStyle = 'rgba(120,160,190,0.07)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const amp = lerp(18, 1.5, easeIO(ramp(t, 0.15, 0.85)));
  const jx = Math.sin(sec * 2 * Math.PI * 5.1) * amp, jy = Math.sin(sec * 2 * Math.PI * 4.3 + 1) * amp * 0.6;
  const ox = 560, oy = 820, appear = ease(ramp(t, 0, 0.15));
  const pts = HAND.map(([x, y], i) => [ox + x * 1.15 + jx * (1 + (-y) / 300), oy + y * 1.15 + jy * (1 + (-y) / 300)]);
  // soft hand silhouette
  ctx.save(); ctx.globalAlpha = 0.16 * appear; ctx.strokeStyle = '#8fb7c9'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = 70; BONES.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(...pts[a]); ctx.lineTo(...pts[b]); ctx.stroke(); });
  ctx.beginPath(); ctx.moveTo(...pts[0]); [1, 5, 9, 13, 17].forEach(i => ctx.lineTo(...pts[i])); ctx.closePath(); ctx.fillStyle = '#8fb7c9'; ctx.fill();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = appear; ctx.strokeStyle = '#39c6e8'; ctx.shadowColor = '#39c6e8'; ctx.shadowBlur = 12; ctx.lineWidth = 3;
  BONES.forEach(([a, b], i) => { if (i / BONES.length > ramp(t, 0, 0.25)) return; ctx.beginPath(); ctx.moveTo(...pts[a]); ctx.lineTo(...pts[b]); ctx.stroke(); });
  ctx.shadowBlur = 0; pts.forEach((p, i) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 7); ctx.fill(); });
  // tracking box
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; const bx = ox - 250, by = oy - 470, bw = 430, bh = 520, c = 26;
  [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x + sx * c, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * c); ctx.stroke(); });
  ctx.restore();
  text('HAND · 21 KEYPOINTS', bx, by - 26, 18, { align: 'left', a: 0.7 * appear, ls: 4, color: '190,220,235' });
  // chart
  const cx = 1060, cy = 300, cw = 700, ch = 420, show = ease(ramp(t, 0.1, 0.3));
  ctx.save(); ctx.globalAlpha = show; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.strokeRect(cx, cy, cw, ch);
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx, cy + ch * i / 4); ctx.lineTo(cx + cw, cy + ch * i / 4); ctx.stroke(); }
  const prog = easeIO(ramp(t, 0.15, 0.9));
  ctx.beginPath(); for (let x = 0; x <= cw * prog; x += 3) { const k = x / cw; const a = lerp(150, 18, Math.pow(k, 0.8));
    const y = cy + ch / 2 + Math.sin(x / 5.2) * a * (0.75 + 0.25 * Math.sin(x / 37)); x ? ctx.lineTo(cx + x, y) : ctx.moveTo(cx + x, y); }
  ctx.strokeStyle = '#7fe3a0'; ctx.lineWidth = 2; ctx.shadowColor = '#7fe3a0'; ctx.shadowBlur = 8; ctx.stroke(); ctx.restore();
  text('TREMOR AMPLITUDE', cx, cy - 34, 20, { align: 'left', a: show * 0.85, ls: 5 });
  text('DAY 1', cx, cy + ch + 34, 18, { align: 'left', a: show * 0.6, ls: 3 });
  text('DAY 30', cx + cw, cy + ch + 34, 18, { align: 'right', a: show * 0.6, ls: 3 });
  text('AI', cx + cw, cy - 34, 20, { align: 'right', a: show * 0.85, ls: 5, color: '57,198,232' });
}
function drawApp(t, sec) {
  // warm out-of-focus background
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a1d14'); g.addColorStop(1, '#0d0a08'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.filter = 'blur(40px)';
  [[300, 260, 160, '#a8743a'], [1500, 220, 200, '#6b4a2a'], [1650, 800, 140, '#3a2a1c'], [420, 860, 220, '#4a3424']].forEach(([x, y, r, c]) => { ctx.fillStyle = c; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(x + Math.sin(sec) * 10, y, r, 0, 7); ctx.fill(); });
  ctx.restore();
  const s = lerp(1.0, 1.06, easeIO(t)); ctx.save(); ctx.translate(W / 2, H / 2 + 30); ctx.scale(s, s); ctx.rotate(-0.04);
  const pw = 440, ph = 900;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.filter = 'blur(30px)'; ctx.fillRect(-pw / 2 + 30, -ph / 2 + 50, pw, ph); ctx.filter = 'none';
  ctx.fillStyle = '#1b1d21'; ctx.beginPath(); ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 64); ctx.fill();
  ctx.fillStyle = '#f5f6f7'; ctx.beginPath(); ctx.roundRect(-pw / 2 + 16, -ph / 2 + 16, pw - 32, ph - 32, 50); ctx.fill();
  ctx.fillStyle = '#1b1d21'; ctx.beginPath(); ctx.roundRect(-60, -ph / 2 + 32, 120, 32, 16); ctx.fill();
  ctx.restore();
  // UI (drawn in same transform via helper)
  ctx.save(); ctx.translate(W / 2, H / 2 + 30); ctx.scale(s, s); ctx.rotate(-0.04);
  const L = -pw / 2 + 50; const tx = (str, x, y, sz, o) => { ctx.save(); ctx.font = `${o.w || 400} ${sz}px ${FONT}`; ctx.letterSpacing = (o.ls || 0) + 'px'; ctx.textAlign = o.al || 'left'; ctx.fillStyle = o.c || '#1b1d21'; ctx.fillText(str, x, y); ctx.restore(); };
  tx(NAME, L, -ph / 2 + 130, 22, { w: 600, ls: 6, c: '#2a6f86' });
  tx('Weekly Report', L, -ph / 2 + 190, 38, { w: 500 });
  tx('Nov 3 – Nov 9', L, -ph / 2 + 228, 20, { c: '#8a929c' });
  const vals = [0.82, 0.74, 0.66, 0.6, 0.48, 0.41, 0.35], days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const base = 80, bw2 = 34, gap = 14;
  vals.forEach((v, i) => { const k = ease(ramp(t, 0.1 + i * 0.06, 0.45 + i * 0.06)); const hgt = 260 * v * k; const x = L + i * (bw2 + gap) + 6;
    ctx.fillStyle = i === 6 ? '#39c6e8' : '#cfd8de'; ctx.beginPath(); ctx.roundRect(x, base - hgt, bw2, hgt, 8); ctx.fill();
    tx(days[i], x + bw2 / 2, base + 34, 18, { al: 'center', c: '#8a929c' }); });
  const pct = Math.round(57 * ease(ramp(t, 0.3, 0.8)));
  tx('Tremor episodes', L, 190, 22, { c: '#8a929c' });
  tx('−' + pct + '%', L, 252, 56, { w: 300, c: '#1b1d21' });
  tx('vs. last week', L + 180, 252, 20, { c: '#8a929c' });
  ctx.fillStyle = '#e8f6fb'; ctx.beginPath(); ctx.roundRect(L, 300, pw - 100, 70, 18); ctx.fill();
  tx('Shared with Dr. Chen', L + 24, 344, 20, { c: '#2a6f86', w: 500 });
  ctx.restore();
}

// ---------- per-frame ----------
async function renderFrame(fr) {
  const s = shots.find(x => fr >= x.f0 && fr < x.f0 + x.n);
  const lf = fr - s.f0, t = lf / (s.n - 1), sec = lf / FPS, gsec = fr / FPS;
  const FIN = { cup: 8, spiral: 4, reveal: 12, cupStill: 12, end: 8, ai: 4 }, FOUT = { cup: 4, ripple: 8, sensor: 4, assemble: 8, app: 8 };
  let fade = 1; const k = s.k;
  if (FIN[k]) fade = Math.min(fade, (lf + 1) / FIN[k]);
  if (FOUT[k]) fade = Math.min(fade, (s.n - lf - 1) / FOUT[k]);
  fade = clamp(fade);
  if (['title', 'spiral', 'ripple', 'ai', 'app'].includes(k)) {
    ({ title: drawTitle, spiral: drawSpiral, ripple: drawRipple, ai: drawAI, app: drawApp })[k](t, sec);
    if (k === 'ripple' || k === 'ai') bloom(0.35);
    finish(fr, fade); return;
  }
  const u = { t: gsec };
  if (k === 'cup' || k === 'cupStill') {
    Object.assign(u, CAM[k](t), { scene: 1, bound: BOUND_W, key: 1 });
    if (k === 'cup') { const j = cupJitter(gsec, 0.045); u.cup = [j[0], j[1], j[2] * 0.6]; u.rip = 0.022 + 0.01 * Math.sin(gsec * 3); }
    else { u.cup = [0, 0, 0]; u.rip = 0.0012 * (1 - t); u.device = 1; u.led = 0.6 + 0.4 * Math.sin(gsec * 2.5); }
  } else {
    Object.assign(u, CAM[k](t), { scene: 0, bound: BOUND_A, rim: 1, key: 1, led: 1 });
    if (k === 'reveal') { u.key = 0.15 + 0.85 * ease(ramp(t, 0.35, 1)); u.rim = ease(ramp(t, 0.1, 0.6)); u.sweep = Math.sin(Math.PI * ramp(t, 0, 0.75)); u.rimX = lerp(-1.6, 1.6, ramp(t, 0, 0.75)); u.led = ease(ramp(t, 0.7, 0.95)); }
    if (k === 'macro') { u.led = ease(ramp(t, 0.25, 0.6)) * (0.75 + 0.25 * Math.sin(sec * 3)); }
    if (k === 'hero') { u.floor = 1; u.spin = -0.5 + easeIO(t) * Math.PI * 1.1; }
    if (k === 'explode') { u.explode = easeIO(ramp(t, 0.08, 0.7)); u.bound = BOUND_E; }
    if (k === 'sensor') { u.explode = 1; u.bound = BOUND_E; u.led = 0.5; }
    if (k === 'assemble') { const e = 1 - easeIO(ramp(t, 0.05, 0.62)); u.explode = e; u.bound = e > 0 ? BOUND_E : BOUND_A;
      u.led = t > 0.62 ? 0.6 + 1.4 * Math.exp(-(t - 0.64) * 30) : 0.4; }
    if (k === 'end') { u.floor = 1; u.spin = -0.32; }
  }
  await drawGL(u);
  ctx.drawImage(glc, 0, 0);
  if (k === 'macro') depthBlur(1, 0.85, 9);
  bloom(k === 'cup' || k === 'cupStill' ? 0.28 : 0.4);
  // overlays
  if (k === 'reveal') { const a = ease(ramp(t, 0.72, 0.92)); text(NAME, W / 2, H * 0.84, 64, { w: 200, a, ls: 28 }); text(TAG, W / 2, H * 0.84 + 62, 18, { w: 300, a: a * 0.7, ls: 9, color: '170,190,205' }); }
  if (k === 'hero') { const a = ease(ramp(t, 0.35, 0.6)) * (1 - ease(ramp(t, 0.9, 1))); text(SLOGAN, W / 2, H * 0.9, 26, { w: 300, a, ls: 14, color: '220,228,236' }); }
  if (k === 'explode' || k === 'sensor') labels(u, k === 'explode' ? ease(ramp(t, 0.62, 0.8)) * (1 - ease(ramp(t, 0.95, 1))) : 0);
  if (k === 'sensor') sensorHUD(t, gsec);
  if (k === 'end') endCard(t);
  finish(fr, fade);
}
const LABELS = [
  ['TOP GLASS', [1.4, 4.2, 0.9]], ['ALUMINIUM BEZEL', [-1.9, 3.5, 0.6]], ['TOP SHELL', [1.95, 2.3, 0.6]], ['MAIN BOARD', [-1.6, 0.87, 0.9]],
  ['6-AXIS IMU', [-0.35, 0.96, 0.15], 1], ['BATTERY', [-1.3, -0.33, -0.7]], ['HAPTIC MOTOR', [1.45, -0.3, 0.9]], ['BOTTOM CASE', [1.9, -1.35, 0.6]], ['SILICONE STRAP', [-1.3, -6.9, 0.8]]];
function labels(s, a) {
  if (a <= 0) return;
  LABELS.forEach(([name, P, force], i) => {
    const ai = a * ease(clamp(a * 1.6 - i * 0.07)); if (ai <= 0) return;
    const [x, y] = project(s, P); const right = force ? true : x > W * 0.5; const ex = force ? x + 360 : right ? x + 90 : x - 90;
    ctx.save(); ctx.globalAlpha = ai; ctx.strokeStyle = 'rgba(57,198,232,0.85)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, y); ctx.stroke(); ctx.fillStyle = '#39c6e8'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); ctx.restore();
    text(name, right ? ex + 12 : ex - 12, y, 17, { a: ai * 0.9, ls: 4, align: right ? 'left' : 'right' });
  });
}
function sensorHUD(t, sec) {
  const a = ease(ramp(t, 0.55, 0.75));
  if (a <= 0) return;
  const x = 1180, y = 330, w = 600, h = 300;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(5,10,14,0.55)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(57,198,232,0.4)'; ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / 6, y); ctx.lineTo(x + w * i / 6, y + h); ctx.stroke(); }
  ctx.beginPath(); for (let i = 0; i <= w; i += 2) { const tt = sec - (w - i) / 300; const v = Math.sin(tt * 2 * Math.PI * 5) * 0.75 + Math.sin(tt * 2 * Math.PI * 11.3) * 0.12 + Math.sin(tt * 37) * 0.05;
    const yy = y + h / 2 - v * h * 0.33; i ? ctx.lineTo(x + i, yy) : ctx.moveTo(x + i, yy); }
  ctx.strokeStyle = '#39c6e8'; ctx.lineWidth = 2.2; ctx.shadowColor = '#39c6e8'; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore();
  text('IMU · 100 Hz SAMPLING', x, y - 30, 17, { align: 'left', a: a * 0.75, ls: 4 });
  text('4–6 Hz', x, y + h + 60, 56, { align: 'left', a, w: 200, ls: 2 });
  text('REST TREMOR BAND', x + 230, y + h + 62, 17, { align: 'left', a: a * 0.75, ls: 4, color: '57,198,232' });
}
function endCard(t) {
  const a = ease(ramp(t, 0.0, 0.35));
  text(NAME, W * 0.72, H * 0.44, 76, { w: 200, a, ls: 30 });
  ctx.fillStyle = `rgba(57,198,232,${a})`; ctx.fillRect(W * 0.72 - 110, H * 0.44 + 62, 220, 1.5);
  text(SLOGAN, W * 0.72, H * 0.44 + 110, 20, { w: 300, a: a * 0.85, ls: 10, color: '200,210,220' });
  text('Reg. No. XXXXXXXX  ·  Please read the instructions for use carefully', W / 2, H - 46, 14, { w: 300, a: a * 0.5, ls: 2, color: '170,175,180' });
}

// ---------- audio ----------
async function makeAudio() {
  const SR = 48000, ac = new OfflineAudioContext(2, SR * 60, SR);
  const master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
  const rev = ac.createConvolver(); { const len = SR * 3.2, b = ac.createBuffer(2, len, SR);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); } rev.buffer = b; }
  const revG = ac.createGain(); revG.gain.value = 0.32; rev.connect(revG).connect(master);
  const bus = (g = 1) => { const n = ac.createGain(); n.gain.value = g; n.connect(master); n.connect(rev); return n; };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const noiseBuf = (() => { const b = ac.createBuffer(1, SR * 2, SR), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  function piano(t, m, v = 0.18, dur = 3.5) {
    const g = ac.createGain(); g.connect(bus(1));
    [[1, 1], [2, 0.35], [3, 0.12], [4.01, 0.06]].forEach(([h, a]) => { const o = ac.createOscillator(); o.frequency.value = mtof(m) * h; const og = ac.createGain();
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(v * a, t + 0.008); og.gain.exponentialRampToValueAtTime(0.0001, t + dur / h); o.connect(og).connect(g); o.start(t); o.stop(t + dur); });
  }
  function pad(t0, t1, notes, v, attack = 2, release = 2.5) {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.3;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + attack); g.gain.setValueAtTime(v, t1); g.gain.linearRampToValueAtTime(0, t1 + release);
    lp.connect(g).connect(bus(1));
    notes.forEach((m, i) => [-6, 6].forEach(det => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det + i;
      const og = ac.createGain(); og.gain.value = 0.05; o.connect(og).connect(lp); o.start(t0); o.stop(t1 + release + 0.1); }));
  }
  function sub(t, v = 0.7) { const o = ac.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(32, t + 1.4);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 2.2); o.connect(g).connect(master); o.start(t); o.stop(t + 2.3); }
  function noise(t, dur, f0, f1, v, q = 1.2, type = 'bandpass') { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f).connect(g).connect(bus(0.8)); s.start(t); s.stop(t + dur + 0.05); }
  function click(t, f = 2200, v = 0.25, d = 0.05) { const s = ac.createBufferSource(); s.buffer = noiseBuf; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 4;
    const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(bp).connect(g).connect(bus(1)); s.start(t); s.stop(t + d + 0.02);
    const o = ac.createOscillator(); o.frequency.setValueAtTime(f / 8, t); o.frequency.exponentialRampToValueAtTime(f / 20, t + d * 2); const og = ac.createGain(); og.gain.setValueAtTime(v * 0.8, t); og.gain.exponentialRampToValueAtTime(0.001, t + d * 2.5); o.connect(og).connect(bus(1)); o.start(t); o.stop(t + d * 3); }
  function glass(t, v = 0.08) { [2630, 5390, 8120].forEach((f, i) => { const o = ac.createOscillator(); o.frequency.value = f * (1 + Math.random() * 0.01); const g = ac.createGain();
    g.gain.setValueAtTime(v / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 / (i + 1)); o.connect(g).connect(bus(1)); o.start(t); o.stop(t + 1); }); }
  // score: A minor -> F -> C -> G, opening sparse piano
  const mel = [[0.6, 69], [2.2, 72], [3.6, 76], [5.2, 74], [6.8, 72], [8.6, 69], [10.2, 67], [11.8, 69], [13.2, 64]];
  mel.forEach(([t, m]) => piano(t, m, 0.13, 4)); [[0.6, 45], [5.2, 41], [10.2, 43]].forEach(([t, m]) => piano(t, m, 0.12, 6));
  pad(0.5, 14.5, [57, 64, 69], 0.10, 3, 2);
  [4.5, 6.1, 7.6].forEach(t => glass(t)); noise(9.2, 3.6, 3000, 2600, 0.03, 0.8);
  noise(13.2, 2.9, 300, 6000, 0.22, 0.9); sub(16.0, 0.9);
  const prog = [[16, [45, 57, 64, 71]], [21, [41, 57, 65, 72]], [26, [48, 55, 64, 72]], [31, [43, 55, 62, 71]], [36, [45, 57, 64, 72]], [41, [41, 57, 65, 69]], [46, [48, 55, 64, 71]], [50, [41, 57, 65, 72]], [55, [48, 55, 64, 67]]];
  prog.forEach(([t, ch], i) => { const nx = (prog[i + 1] || [59.5])[0]; pad(t, nx - 0.2, ch, i >= 7 ? 0.17 : 0.13, 1.2, 1.6);
    for (let b = 0; b < (nx - t) / 0.625; b++) { const bt = t + b * 0.625; if (bt < 46 || bt > 50) piano(bt, ch[1 + (b % 3)] + 12, 0.045 + (i >= 7 ? 0.02 : 0), 1.6); } });
  [72, 76, 79, 76, 74, 72].forEach((m, i) => piano(50.2 + i * 0.8, m, 0.12, 4)); piano(55.2, 72, 0.12, 6); piano(55.2, 48, 0.14, 6);
  sub(58.0, 0.6); piano(58.05, 84, 0.08, 4);
  for (let i = 0; i < 9; i++) click(30.6 + i * 0.27, 1800 + i * 120, 0.22);
  for (let i = 0; i < 18; i++) click(37.0 + i * 0.22, 5200, 0.05, 0.02);
  for (let i = 0; i < 20; i++) click(41.4 + i * 0.22, 4800, 0.04, 0.02);
  noise(46.2, 1.9, 6000, 400, 0.12, 0.9); click(48.55, 3200, 0.5, 0.06); click(48.6, 1200, 0.35, 0.08);
  noise(20.8, 1.0, 900, 4000, 0.05, 1.2); noise(25.0, 1.2, 600, 3000, 0.05, 1.2); noise(49.6, 1.0, 600, 3000, 0.06);
  // fade out
  master.gain.setValueAtTime(0.8, 57.5); master.gain.linearRampToValueAtTime(0.0, 60);
  const buf = await ac.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = peak > 0 ? 0.89 / peak : 1;
  const pcm = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[2 * i] = clamp(L[i] * gain, -1, 1) * 32767; pcm[2 * i + 1] = clamp(R[i] * gain, -1, 1) * 32767; }
  return new Uint8Array(pcm.buffer);
}

// ---------- QuickTime muxer ----------
function box(type, ...parts) {
  const body = parts.flat(Infinity).filter(p => p != null);
  let len = 8; body.forEach(p => len += p.length);
  const o = new Uint8Array(len), dv = new DataView(o.buffer); dv.setUint32(0, len); for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i);
  let off = 8; body.forEach(p => { o.set(p, off); off += p.length; }); return o;
}
const u8 = (...v) => new Uint8Array(v);
const u16 = v => u8(v >> 8 & 255, v & 255);
const u32 = v => u8(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
const str4 = s => u8(...[...s].map(c => c.charCodeAt(0)));
const zeros = n => new Uint8Array(n);
const pstr = s => u8(s.length, ...[...s].map(c => c.charCodeAt(0)));
const MATRIX = [u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)];
function buildMov(vSamples, avcC, pcm) {
  const ftyp = box('ftyp', str4('qt  '), u32(0x20050300), str4('qt  '));
  // mdat layout: all video samples, then audio in 1 s chunks
  const AUD_CH = 48000 * 4; const aChunks = []; for (let o = 0; o < pcm.length; o += AUD_CH) aChunks.push(pcm.subarray(o, Math.min(o + AUD_CH, pcm.length)));
  let mdatLen = 8; vSamples.forEach(s => mdatLen += s.data.length); aChunks.forEach(c => mdatLen += c.length);
  let off = ftyp.length + 8; const vOff = vSamples.map(s => { const o = off; off += s.data.length; return o; }); const aOff = aChunks.map(c => { const o = off; off += c.length; return o; });
  const durMs = 60000, vN = vSamples.length, aN = pcm.length / 4;
  const dinf = box('dinf', box('dref', u32(0), u32(1), box('alis', u32(1))));
  const tkhd = (id, w, h, vol) => box('tkhd', u32(0x0000000f), u32(0), u32(0), u32(id), u32(0), u32(durMs), zeros(8), u16(0), u16(id === 2 ? 1 : 0), u16(vol), u16(0), MATRIX, u32(w << 16), u32(h << 16));
  const mdhd = (ts, dur) => box('mdhd', u32(0), u32(0), u32(0), u32(ts), u32(dur), u16(0x7fff), u16(0));
  const hdlr = (type, sub, name) => box('hdlr', u32(0), str4(type), str4(sub), u32(0), u32(0), u32(0), pstr(name));
  const avc1 = box('avc1', zeros(6), u16(1), u16(0), u16(0), str4('appl'), u32(0), u32(0x400), u16(W), u16(H), u32(0x480000), u32(0x480000), u32(0), u16(1),
    (() => { const n = zeros(32); const nm = 'H.264'; n[0] = nm.length; for (let i = 0; i < nm.length; i++) n[1 + i] = nm.charCodeAt(i); return n; })(), u16(24), u16(0xffff), box('avcC', avcC));
  const vStbl = box('stbl', box('stsd', u32(0), u32(1), avc1), box('stts', u32(0), u32(1), u32(vN), u32(1)),
    box('stss', u32(0), u32(vSamples.filter(s => s.key).length), vSamples.map((s, i) => s.key ? u32(i + 1) : null)),
    box('stsc', u32(0), u32(1), u32(1), u32(1), u32(1)), box('stsz', u32(0), u32(0), u32(vN), vSamples.map(s => u32(s.data.length))),
    box('stco', u32(0), u32(vN), vOff.map(u32)));
  const vTrak = box('trak', tkhd(1, W, H, 0), box('mdia', mdhd(FPS, vN), hdlr('mhlr', 'vide', 'VideoHandler'),
    box('minf', box('vmhd', u32(1), u16(0x40), u16(0x8000), u16(0x8000), u16(0x8000)), hdlr('dhlr', 'alis', 'DataHandler'), dinf, vStbl)));
  const sowt = box('sowt', zeros(6), u16(1), u16(0), u16(0), u32(0), u16(2), u16(16), u16(0), u16(0), u32(48000 * 65536 >>> 0));
  const lastCh = aChunks.length, perCh = 48000, lastN = (aChunks[lastCh - 1].length / 4);
  const stscA = lastN === perCh ? [u32(1), u32(1), u32(perCh), u32(1)] : [u32(2), u32(1), u32(perCh), u32(1), u32(lastCh), u32(lastN), u32(1)];
  const aStbl = box('stbl', box('stsd', u32(0), u32(1), sowt), box('stts', u32(0), u32(1), u32(aN), u32(1)), box('stsc', u32(0), stscA),
    box('stsz', u32(0), u32(4), u32(aN)), box('stco', u32(0), u32(aChunks.length), aOff.map(u32)));
  const aTrak = box('trak', tkhd(2, 0, 0, 0x100), box('mdia', mdhd(48000, aN), hdlr('mhlr', 'soun', 'SoundHandler'),
    box('minf', box('smhd', u32(0), u16(0), u16(0)), hdlr('dhlr', 'alis', 'DataHandler'), dinf, aStbl)));
  const mvhd = box('mvhd', u32(0), u32(0), u32(0), u32(1000), u32(durMs), u32(0x10000), u16(0x100), zeros(10), MATRIX, zeros(24), u32(3));
  const moov = box('moov', mvhd, vTrak, aTrak);
  const hdr = new Uint8Array(8); new DataView(hdr.buffer).setUint32(0, mdatLen); hdr.set(str4('mdat'), 4);
  return new Blob([ftyp, hdr, ...vSamples.map(s => s.data), ...aChunks, moov], { type: 'video/quicktime' });
}

// ---------- driver ----------
window.state = { frame: 0, done: false, err: null, t0: 0 };
window.preview = async (fr) => { await renderFrame(fr); return out.toDataURL('image/jpeg', 0.85); };
window.timeFrame = async (fr) => { const a = performance.now(); await renderFrame(fr); return performance.now() - a; };
window.run = async (from = 0, to = TOTAL) => {
  try {
    state.t0 = performance.now();
    const samples = []; let avcC = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC) avcC = new Uint8Array(meta.decoderConfig.description);
      const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); samples.push({ data: d, key: chunk.type === 'key', ts: chunk.timestamp }); }, error: e => state.err = String(e) });
    enc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 12_000_000, framerate: FPS, avc: { format: 'avc' }, latencyMode: 'quality' });
    state.audio = makeAudio();
    for (let fr = from; fr < to; fr++) {
      state.frame = fr; await renderFrame(fr);
      const vf = new VideoFrame(out, { timestamp: Math.round(fr * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(vf, { keyFrame: fr % 50 === 0 }); vf.close();
      while (enc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 5));
    }
    await enc.flush(); enc.close();
    samples.sort((a, b) => a.ts - b.ts);
    const pcm = await state.audio;
    Object.assign(state, { samples, avcC, pcm });
    state.blob = buildMov(samples, avcC, pcm);
    state.wav = wav(pcm);
    state.done = true; state.secs = (performance.now() - state.t0) / 1000;
  } catch (e) { state.err = e.stack || String(e); }
};
function wav(pcm) { const h = new DataView(new ArrayBuffer(44)); const w = (o, s) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); h.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 2, true);
  h.setUint32(24, 48000, true); h.setUint32(28, 192000, true); h.setUint16(32, 4, true); h.setUint16(34, 16, true); w(36, 'data'); h.setUint32(40, pcm.length, true);
  return new Blob([h, pcm], { type: 'audio/wav' }); }
window.download = (which, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(state[which]); a.download = name; document.body.appendChild(a); a.click(); };
document.getElementById('log').textContent = 'ready';
