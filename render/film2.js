// STEADY tremor analysis system - 60 s film v2 (hospital floor-standing analyser, CG hands, DOF)
const W = 1920, H = 1080, FPS = 25, TOTAL = 1500, DUR_MS = 60000;
const RW = 2304, RH = 1296; // supersampled pass-1 resolution
const NAME = 'STEADY';
const SUB = 'TREMOR ANALYSIS SYSTEM';

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeIO = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, s) => a.map(v => v * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => mul(a, 1 / len(a));
function rotAxis(v, a, th) { const c = Math.cos(th), s = Math.sin(th); return add(add(mul(v, c), mul(cross(a, v), s)), mul(a, dot(a, v) * (1 - c))); }
const TAU = Math.PI * 2;

// ---------- GL ----------
const glc = document.createElement('canvas'); glc.width = W; glc.height = H;
const gl = glc.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('no float render targets');
gl.getExtension('OES_texture_float_linear');
function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;
function program(id) { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, document.getElementById(id).textContent.trim()));
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
const P1 = program('fs1'), P2 = program('fs2');
const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
function tex(unit, w, h, internal, format, type, filter) { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
const scrC = document.createElement('canvas'); scrC.width = 1280; scrC.height = 538; const sg = scrC.getContext('2d');
const papC = document.createElement('canvas'); papC.width = 1024; papC.height = 748; const pg = papC.getContext('2d');
const tScr = tex(0, 1280, 538, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
const tPap = tex(1, 1024, 748, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
const tHDR = tex(2, RW, RH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tHDR, 0);
if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo incomplete');
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
const U1 = n => gl.getUniformLocation(P1, n), U2 = n => gl.getUniformLocation(P2, n);

function uploadCanvas(unit, t, c) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); }

async function drawGL(s) {
  // ---- pass 1 ----
  const ss = s.ss || 1.0, rw = Math.round(W * ss), rh = Math.round(H * ss);
  gl.useProgram(P1); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, rw, rh);
  const f = (n, v) => { const l = U1(n); if (l) gl.uniform1f(l, v); };
  const v3 = (n, v) => { const l = U1(n); if (l) gl.uniform3fv(l, v); };
  const v4 = (n, v) => { const l = U1(n); if (l) gl.uniform4fv(l, v); };
  gl.uniform2f(U1('uRes'), rw, rh); v3('uRo', s.ro); v3('uTa', s.ta); f('uZoom', s.zoom); f('uT', s.t || 0);
  gl.uniform1i(U1('uScene'), s.scene);
  f('uExplode', s.explode || 0); f('uBar', s.bar || 0); f('uScrB', s.scr || 0); f('uKey', s.key ?? 1); f('uRip', s.rip || 0); f('uSpin', s.spin || 0);
  f('uBeam', s.beam || 0); f('uBeamH', s.beamH || 1);
  v4('uBound', s.bound); v4('uCupT', s.cup || [0, 0, 0, 0]);
  v4('uPen0', s.pen0 || [0, -50, 0, 0.2]); v4('uPen1', s.pen1 || [0, -49, 0, 0]);
  const G = s.groups || [];
  const CA = new Float32Array(80 * 4), CB = new Float32Array(80 * 4), GR = new Int32Array(12), GB = new Float32Array(24), GZ = new Float32Array(24), GK = new Float32Array(6);
  let ci = 0;
  G.forEach((g, gi) => { GR[gi * 2] = ci; GR[gi * 2 + 1] = g.caps.length;
    let c = [0, 0, 0]; g.caps.forEach(k => { c = add(c, add(k[0], k[2])); }); c = mul(c, 1 / (2 * g.caps.length));
    let r = 0; g.caps.forEach(k => { r = Math.max(r, len(sub(k[0], c)) + k[1], len(sub(k[2], c)) + k[3]); });
    GB.set([...c, r + 0.05], gi * 4); GZ.set([0, 0, 0, g.mat], gi * 4); GK[gi] = g.k;
    g.caps.forEach(k => { CA.set([...k[0], k[1]], ci * 4); CB.set([...k[2], k[3]], ci * 4); ci++; }); });
  if (ci > 80) throw new Error('too many capsules ' + ci);
  gl.uniform4fv(U1('uCA'), CA); gl.uniform4fv(U1('uCB'), CB); gl.uniform2iv(U1('uGR'), GR); gl.uniform4fv(U1('uGB'), GB); gl.uniform4fv(U1('uGZ'), GZ); gl.uniform1fv(U1('uGK'), GK);
  gl.uniform1i(U1('uNG'), G.length);
  gl.uniform1i(U1('uScr'), 0); gl.uniform1i(U1('uPaper'), 1);
  gl.enable(gl.SCISSOR_TEST);
  const STR = 16, hh = Math.ceil(rh / STR);
  for (let i = 0; i < STR; i++) { gl.scissor(0, i * hh, rw, hh); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish(); await new Promise(r => setTimeout(r, 0)); }
  gl.disable(gl.SCISSOR_TEST);
  // ---- pass 2 ----
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(P2); gl.viewport(0, 0, W, H);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tHDR); gl.uniform1i(U2('uTex'), 2);
  gl.uniform2f(U2('uOut'), W, H); gl.uniform1f(U2('uFocus'), s.focus || 10); gl.uniform1f(U2('uAper'), s.aper || 0); gl.uniform1f(U2('uMaxR'), s.aper ? Math.min(28, s.aper * 1.2) : 0);
  gl.uniform1f(U2('uExpo'), s.expo || 1); gl.uniform1f(U2('uGrade'), 1); gl.uniform1f(U2('uScale'), rw / RW);
  gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish();
}
function project(s, P) { const f = norm(sub(s.ta, s.ro)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), d = sub(P, s.ro); const z = dot(d, f);
  return [W / 2 + dot(d, r) / z * s.zoom * H, H / 2 - dot(d, u) / z * s.zoom * H]; }

// ---------- hands ----------
const FINGERS = [
  { mcp: [0.36, 0.93, 0], L: [0.45, 0.27, 0.2], R: [0.1, 0.092, 0.083, 0.074], sp: 0.1 },
  { mcp: [0.12, 0.97, 0], L: [0.5, 0.31, 0.21], R: [0.104, 0.096, 0.087, 0.077], sp: 0.02 },
  { mcp: [-0.12, 0.93, 0], L: [0.47, 0.29, 0.2], R: [0.1, 0.091, 0.082, 0.072], sp: -0.07 },
  { mcp: [-0.34, 0.83, 0], L: [0.37, 0.22, 0.18], R: [0.088, 0.08, 0.072, 0.064], sp: -0.18 }];
const META = [[0.2, 0.12, 0], [0.07, 0.1, 0], [-0.07, 0.1, 0], [-0.2, 0.14, 0]];
// o: {W: wrist world, X: thumb dir, Y: finger dir, Z: back-of-hand dir, s: palm width, curls: [[i],[m],[r],[p],[thumb]], arm: dir, armLen, sleeve, sleeveR, skin, sleeveMat}
function buildHand(o) {
  const L = v => add(o.W, add(add(mul(o.X, v[0] * o.s), mul(o.Y, v[1] * o.s)), mul(o.Z, v[2] * o.s)));
  const Ld = v => norm(add(add(mul(o.X, v[0]), mul(o.Y, v[1])), mul(o.Z, v[2])));
  const skin = [], tips = {};
  META.forEach((b, i) => skin.push([L(b), 0.15 * o.s, L(FINGERS[i].mcp), (FINGERS[i].R[0] + 0.03) * o.s]));
  skin.push([L([0.3, 0.86, -0.02]), 0.11 * o.s, L([-0.3, 0.78, -0.02]), 0.1 * o.s]);
  skin.push([L([0.2, 0.3, -0.05]), 0.15 * o.s, L([-0.18, 0.45, -0.05]), 0.14 * o.s]);
  FINGERS.forEach((F, i) => {
    let d = Ld([Math.sin(F.sp), Math.cos(F.sp), 0]); const ax = norm(cross(d, mul(o.Z, -1)));
    let p = L(F.mcp); const c = o.curls[i];
    for (let k = 0; k < 3; k++) { d = rotAxis(d, ax, c[k]); const q = add(p, mul(d, F.L[k] * o.s)); skin.push([p, F.R[k] * o.s, q, F.R[k + 1] * o.s]); p = q; }
    tips[i] = p;
  });
  { // thumb
    let d = Ld(o.thumbDir || [0.62, 0.62, -0.45]); const ax = norm(cross(d, mul(o.Z, -1)));
    let p = L([0.3, 0.2, -0.06]); const c = o.curls[4], TL = [0.42, 0.33, 0.27], TR = [0.155, 0.13, 0.112, 0.096];
    for (let k = 0; k < 3; k++) { d = rotAxis(d, ax, c[k]); const q = add(p, mul(d, TL[k] * o.s)); skin.push([p, TR[k] * o.s, q, TR[k + 1] * o.s]); p = q; }
    tips[4] = p;
  }
  // wrist + forearm (two capsules give an elliptical section)
  const arm = o.arm, aEnd = add(o.W, mul(arm, o.sleeve != null ? o.sleeve + 0.9 : o.armLen));
  const sl = o.sleeve != null;
  [-0.12, 0.12].forEach(x => { const off = mul(o.X, x * o.s); skin.push([add(L([0, 0.12, 0]), off), 0.25 * o.s, add(aEnd, mul(off, sl ? 0.9 : 1.3)), (sl ? 0.25 : 0.3) * o.s]); });
  const groups = [{ caps: skin, mat: o.skin, k: 0.12 * o.s }];
  if (o.sleeve != null) groups.push({ caps: [[add(o.W, mul(arm, o.sleeve)), o.sleeveR * o.s, add(o.W, mul(arm, o.armLen + 14)), o.sleeveR * 1.25 * o.s]], mat: o.sleeveMat, k: 0 });
  return { groups, tips, L };
}
function frame(Y, Z, right) { Y = norm(Y); Z = norm(sub(Z, mul(Y, dot(Z, Y)))); const X = right ? cross(Z, Y) : cross(Y, Z); return { X, Y, Z }; }
function rotFrame(fr, ax, th) { return { X: rotAxis(fr.X, ax, th), Y: rotAxis(fr.Y, ax, th), Z: rotAxis(fr.Z, ax, th) }; }
const SKIN_P = 31, SKIN_D = 32, KNIT = 33, COAT = 34;

// ---------- cup grip (home scene, 1 unit = 2.7 cm) ----------
function cupHand(t, amp) {
  const jx = amp * (Math.sin(t * TAU * 5.2) * 0.7 + Math.sin(t * TAU * 3.1 + 1) * 0.3), jy = amp * 0.5 * Math.sin(t * TAU * 4.4 + 2), roll = amp * 0.3 * Math.sin(t * TAU * 5.2 + 0.4);
  const T = [jx + 0.0, 0.22 + jy, 0.0];
  const c = Math.cos(roll), s = Math.sin(roll);
  const Wd = l => [T[0] + (l[0] * c + l[1] * s), T[1] + (-l[0] * s + l[1] * c), T[2] + l[2]];
  const S = 3.1, skin = [];
  const heights = [2.5, 1.9, 1.33, 0.82];
  const mcps = heights.map((h, i) => [1.86, h, 0.32 - i * 0.05]);
  const wrist = [2.55, 1.45, -2.55];
  META.forEach((b, i) => { const base = add(wrist, [(-0.05) * S, (0.2 - i * 0.13) * S, 0.15 * S]); skin.push([base, 0.15 * S, mcps[i], (FINGERS[i].R[0] + 0.03) * S]); });
  skin.push([mcps[0], 0.32, mcps[3], 0.3]);
  skin.push([add(wrist, [-0.1, 0.4, 0.7]), 0.46, [2.0, 1.4, -0.6], 0.42]);
  FINGERS.forEach((F, i) => {
    let p = mcps[i]; const rr = 1.3 + F.R[1] * S * 0.95; let phi = Math.atan2(p[2], p[0]);
    for (let k = 0; k < 3; k++) { phi += (F.L[k] * S) / rr * 1.02; const q = [Math.cos(phi) * rr, p[1] - 0.05, Math.sin(phi) * rr]; skin.push([p, F.R[k] * S, q, F.R[k + 1] * S]); p = q; }
  });
  { // thumb wraps the back
    const cmc = [2.3, 2.15, -1.55]; let p = cmc; const TR = [0.155, 0.13, 0.112, 0.096], TL = [0.42, 0.33, 0.27]; const rr = 1.3 + 0.36;
    let phi = Math.atan2(-1.05, 1.5);
    const p1 = [Math.cos(phi) * (rr + 0.25), 2.65, Math.sin(phi) * (rr + 0.25)]; skin.push([p, TR[0] * S, p1, TR[1] * S]); p = p1;
    for (let k = 1; k < 3; k++) { phi -= TL[k] * S / rr; const q = [Math.cos(phi) * rr, 2.75, Math.sin(phi) * rr]; skin.push([p, TR[k] * S, q, TR[k + 1] * S]); p = q; }
  }
  const arm = norm([1.0, -0.32, -0.85]), aEnd = add(wrist, mul(arm, 3.3));
  [-0.37, 0.37].forEach(y => { skin.push([add(wrist, [0, y, 0]), 0.78, add(aEnd, [0, y * 1.3, 0]), 0.93]); });
  const sleeve = [[add(wrist, mul(arm, 2.4)), 1.32, add(wrist, mul(arm, 11)), 1.5]];
  const tr = caps => caps.map(k => [Wd(k[0]), k[1], Wd(k[2]), k[3]]);
  return { cup: [T[0], T[1], T[2], roll], groups: [{ caps: tr(skin), mat: SKIN_P, k: 0.36 }, { caps: tr(sleeve), mat: KNIT, k: 0 }] };
}

// ---------- spiral + writing hand ----------
const SPIRAL = (() => { const pts = []; for (let i = 0; i <= 900; i++) { const a = i / 46, r = 0.12 + a * 0.155;
  const j = 0.055 * (Math.sin(i * 0.9) + 0.7 * Math.sin(i * 0.37 + 1) + 0.35 * Math.sin(i * 2.1));
  pts.push([Math.cos(a) * (r + j) - 0.3, Math.sin(a) * (r + j * 0.8) * 0.95 + 0.1]); } return pts; })();
function drawPaper(n) {
  pg.fillStyle = '#ffffff'; pg.fillRect(0, 0, 1024, 748);
  pg.strokeStyle = 'rgba(160,185,215,0.12)'; pg.lineWidth = 1;
  for (let y = 60; y < 748; y += 40) { pg.beginPath(); pg.moveTo(0, y); pg.lineTo(1024, y); pg.stroke(); }
  const P = ([x, z]) => [(x / 10.4 + 0.5) * 1024, (z / 7.6 + 0.5) * 748];
  pg.lineCap = 'round'; pg.lineJoin = 'round'; pg.strokeStyle = 'rgba(25,30,60,0.92)'; pg.lineWidth = 2.6;
  pg.beginPath(); SPIRAL.slice(0, n).forEach((p, i) => { const q = P(p); i ? pg.lineTo(q[0], q[1]) : pg.moveTo(q[0], q[1]); }); pg.stroke();
}
function penHand(t, n) {
  const tipT = SPIRAL[Math.max(0, n - 1)];
  const tremor = 0.06;
  const th = tremor * Math.sin(t * TAU * 5.1), th2 = tremor * 0.7 * Math.sin(t * TAU * 4.3 + 1.3);
  let fr = frame([-0.55, -0.55, -0.62], [0.58, 0.78, -0.1], true);
  fr = rotFrame(fr, fr.X, th); fr = rotFrame(fr, [0, 1, 0], th2);
  const S = 3.0;
  const o = { W: [0, 0, 0], ...fr, s: S, curls: [[0.5, 0.6, 0.2], [0.8, 0.9, 0.4], [1.2, 1.2, 0.7], [1.35, 1.2, 0.7], [0.2, 0.3, 0.3]], thumbDir: [0.55, 0.75, -0.55],
    arm: norm([0.78, 0.02, 0.62]), armLen: 9, sleeve: 2.4, sleeveR: 0.44, skin: SKIN_P, sleeveMat: KNIT };
  let h = buildHand(o);
  let minY = Infinity; h.groups[0].caps.forEach(k => { minY = Math.min(minY, k[0][1] - k[1], k[2][1] - k[3]); });
  const lift = 0.05 - minY;
  // pen axis runs from the index pad through the thumb pad; tip continues down to the paper
  const iT = add(h.tips[0], [0, lift, 0]), tT = add(h.tips[4], [0, lift, 0]);
  const D = norm(sub(tT, iT));
  const k = (iT[1] - 0.0) / D[1]; const tip = sub(iT, mul(D, k));
  const shift = [tipT[0] - tip[0], lift, tipT[1] - tip[2]];
  const mv = caps => caps.map(c => [add(c[0], shift), c[1], add(c[2], shift), c[3]]);
  const tipW = [tipT[0], 0.0, tipT[1]]; const endW = add(tipW, mul(D, 5.4));
  return { groups: h.groups.map(g => ({ ...g, caps: mv(g.caps) })), pen0: [...tipW, 0.2], pen1: [...endW, 0], tip: tipW };
}

// ---------- clinic hands (1 unit = 5 cm) ----------
const HS = 1.7;
function patientHands(t, pose, trem) {
  // pose: wrist height/position blend; trem amplitude
  const out = [];
  [-1, 1].forEach(side => {
    const right = side > 0;
    const ph = side > 0 ? 0 : 1.7;
    const a = trem * (1 + (right ? 0.6 : 0)), w = Math.sin(t * TAU * 5.1 + ph) * a, w2 = Math.sin(t * TAU * 4.6 + ph * 2) * a * 0.6;
    const Wp = lerp3([side * 3.5, 16.3, 9.6], [side * 3.5, 21.0, 5.85], pose);
    const pitch = lerp(0.55, 0, pose);
    let fr = frame([0, 0, -1], [0, 1, 0], right);
    fr = rotFrame(fr, fr.X, pitch * (right ? -1 : 1) * -1 + w * 0.06);
    fr = rotFrame(fr, [0, 0, 1], w2 * 0.05 * side);
    const Wt = add(Wp, [0, w * 0.05, 0]);
    const cur = [[0.08, 0.1, 0.05], [0.1, 0.12, 0.06], [0.12, 0.14, 0.08], [0.15, 0.15, 0.1], [0.1 + w * 0.04, 0.15, 0.1]];
    const h = buildHand({ W: Wt, ...fr, s: HS, curls: cur, arm: norm([side * 0.22, -0.14 - pitch * 0.4, 1]), armLen: 12, sleeve: 1.7, sleeveR: 0.42, skin: SKIN_P, sleeveMat: KNIT });
    out.push(...h.groups);
  });
  return out;
}
function doctorHand(C, extra = {}) {
  // doctor's right hand resting palm-down with palm centre at C, fingers pointing -x
  const fr = frame([-1, 0, 0.05], [0, 1, 0], true);
  const Wd = sub(C, add(mul(fr.Y, 0.5 * HS), [0, 0, 0]));
  return buildHand({ W: Wd, ...fr, s: HS, curls: extra.curls || [[0.35, 0.35, 0.2], [0.38, 0.38, 0.22], [0.4, 0.4, 0.22], [0.42, 0.4, 0.2], [0.2, 0.25, 0.15]],
    arm: norm([1, 0.18, 0.4]), armLen: 12, sleeve: 1.2, sleeveR: 0.5, skin: SKIN_D, sleeveMat: COAT }).groups;
}

// ---------- screen UI ----------
const UIF = '"Noto Sans", sans-serif';
function ui(state, t, sec, amp) {
  const g = sg, w = 1280, h = 538;
  g.fillStyle = '#05080b'; g.fillRect(0, 0, w, h);
  if (state === 'off') return;
  const T = (s, x, y, sz, c = '#e8eef3', wt = 400, al = 'left') => { g.font = `${wt} ${sz}px ${UIF}`; g.textAlign = al; g.fillStyle = c; g.fillText(s, x, y); };
  if (state === 'boot') { const a = ease(ramp(t, 0.1, 0.6)); g.globalAlpha = a; T(NAME, w / 2, h / 2, 64, '#ffffff', 200, 'center'); T(SUB, w / 2, h / 2 + 50, 18, '#39c6e8', 400, 'center'); g.globalAlpha = 1; return; }
  // top bar
  g.fillStyle = '#0c1218'; g.fillRect(0, 0, w, 54); T(NAME, 28, 36, 22, '#ffffff', 600); T(SUB, 140, 35, 14, '#7e8b96');
  T('Neurology · Room 3', w - 28, 35, 15, '#7e8b96', 400, 'right');
  g.fillStyle = '#0f171e'; g.beginPath(); g.roundRect(24, 72, 300, h - 96, 14); g.fill();
  T('PATIENT', 46, 106, 13, '#7e8b96', 600); T('ID 0472', 46, 140, 24, '#ffffff', 500); T('Male · 68 y', 46, 168, 16, '#9fb0bd');
  T('PROBES', 46, 222, 13, '#7e8b96', 600);
  ['L', 'C', 'R'].forEach((p, i) => { g.fillStyle = '#39c6e8'; g.beginPath(); g.arc(56, 252 + i * 34, 6, 0, 7); g.fill(); T('Probe ' + p + '  ready', 72, 258 + i * 34, 16, '#cfe3ec'); });
  T('TEST', 46, 380, 13, '#7e8b96', 600); T('Postural tremor', 46, 410, 18, '#ffffff'); T('Hands level · 30 s', 46, 436, 15, '#9fb0bd');
  const X0 = 350, Y0 = 72, PW = w - X0 - 24, PH = h - 96;
  g.fillStyle = '#0f171e'; g.beginPath(); g.roundRect(X0, Y0, PW, PH, 14); g.fill();
  if (state === 'home') {
    T('Place both hands level above the probes', X0 + PW / 2, Y0 + 70, 26, '#ffffff', 300, 'center');
    [-1, 0, 1].forEach(i => { const cx = X0 + PW / 2 + i * 190, cy = Y0 + 270; const pulse = 0.5 + 0.5 * Math.sin(sec * 3 + i);
      g.strokeStyle = `rgba(57,198,232,${0.3 + 0.5 * pulse})`; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 34 + pulse * 6, 0, 7); g.stroke();
      g.fillStyle = '#39c6e8'; g.beginPath(); g.arc(cx, cy, 14, 0, 7); g.fill(); });
    T('Ready', X0 + PW / 2, Y0 + 400, 18, '#39c6e8', 500, 'center');
    return;
  }
  if (state === 'live') {
    T('LIVE · POSTURAL TREMOR', X0 + 24, Y0 + 38, 14, '#39c6e8', 600);
    T(String(Math.floor(sec % 30)).padStart(2, '0') + ' / 30 s', X0 + PW - 24, Y0 + 38, 14, '#7e8b96', 400, 'right');
    const rows = [['LEFT', 0.82, 0.0, '#39c6e8'], ['RIGHT', 1.36, 1.7, '#7fe3a0']];
    rows.forEach(([lab, a, ph, col], r) => {
      const y0 = Y0 + 70 + r * 170, gh = 140, gw = PW - 250;
      g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(X0 + 24, y0 + gh * k / 4); g.lineTo(X0 + 24 + gw, y0 + gh * k / 4); g.stroke(); }
      g.beginPath(); for (let x = 0; x <= gw; x += 2) { const tt = sec - (gw - x) / 260; const v = Math.sin(tt * TAU * 5.1 + ph) * a * amp + 0.12 * Math.sin(tt * 37 + r) * amp;
        const y = y0 + gh / 2 - v * gh * 0.28; x ? g.lineTo(X0 + 24 + x, y) : g.moveTo(X0 + 24 + x, y); }
      g.strokeStyle = col; g.lineWidth = 2.4; g.stroke();
      T(lab, X0 + PW - 200, y0 + 30, 14, '#7e8b96', 600);
      T((a * amp).toFixed(2) + ' mm', X0 + PW - 200, y0 + 78, 34, '#ffffff', 300);
      T('5.1 Hz', X0 + PW - 200, y0 + 112, 18, col, 500);
    });
    return;
  }
  if (state === 'report') {
    T('ASSESSMENT COMPLETE', X0 + 24, Y0 + 38, 14, '#7fe3a0', 600);
    const k = ease(ramp(t, 0.05, 0.5));
    [['Left amplitude', '0.82 mm', 0.42], ['Right amplitude', '1.36 mm', 0.7], ['Dominant frequency', '5.1 Hz', 0.55]].forEach(([l, v, f], i) => {
      const y = Y0 + 80 + i * 76; T(l, X0 + 24, y, 16, '#9fb0bd'); T(v, X0 + 380, y + 4, 26, '#ffffff', 300);
      g.fillStyle = '#1b2731'; g.beginPath(); g.roundRect(X0 + 24, y + 16, 320, 8, 4); g.fill();
      g.fillStyle = i === 1 ? '#7fe3a0' : '#39c6e8'; g.beginPath(); g.roundRect(X0 + 24, y + 16, 320 * f * k, 8, 4); g.fill(); });
    const cx = X0 + 560, cy = Y0 + 60, cw = PW - 590, ch = 260;
    T('TREND · LAST 6 VISITS', cx, cy + 6, 13, '#7e8b96', 600);
    g.strokeStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(cx, cy + 30 + ch * i / 4); g.lineTo(cx + cw, cy + 30 + ch * i / 4); g.stroke(); }
    const vals = [1.62, 1.55, 1.48, 1.51, 1.42, 1.36];
    g.beginPath(); vals.forEach((v, i) => { const x = cx + cw * i / 5, y = cy + 30 + ch * (1 - (v - 1.0) / 0.8); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.strokeStyle = '#7fe3a0'; g.lineWidth = 2.5; g.stroke();
    vals.forEach((v, i) => { const x = cx + cw * i / 5, y = cy + 30 + ch * (1 - (v - 1.0) / 0.8); g.fillStyle = '#7fe3a0'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
    g.fillStyle = '#16323d'; g.beginPath(); g.roundRect(X0 + 24, Y0 + PH - 70, 300, 46, 10); g.fill(); T('Export report', X0 + 174, Y0 + PH - 40, 17, '#39c6e8', 500, 'center');
  }
}

// ---------- 2D compositing ----------
const out = document.getElementById('out'); out.width = W; out.height = H; const ctx = out.getContext('2d');
const small = document.createElement('canvas'); small.width = W / 4; small.height = H / 4; const sctx = small.getContext('2d');
const grain = document.createElement('canvas'); grain.width = grain.height = 256;
{ const g = grain.getContext('2d'), id = g.createImageData(256, 256); let seed = 7;
  for (let i = 0; i < id.data.length; i += 4) { seed = (seed * 16807) % 2147483647; const v = seed % 256; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); }
const FONT = '"Noto Sans", sans-serif';
function text(str, x, y, size, { w = 300, a = 1, ls = 0, align = 'center', color = '255,255,255' } = {}) {
  ctx.save(); ctx.font = `${w} ${size}px ${FONT}`; ctx.letterSpacing = ls + 'px'; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(${color},${a})`; ctx.fillText(str, x + (align === 'center' ? ls / 2 : 0), y); ctx.restore(); }
function bloom(amount) { sctx.filter = 'brightness(0.6) contrast(3.4) blur(6px)'; sctx.clearRect(0, 0, W / 4, H / 4); sctx.drawImage(out, 0, 0, W / 4, H / 4);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = amount; ctx.filter = 'blur(10px)'; ctx.drawImage(small, 0, 0, W, H); ctx.restore(); }
function finish(fr, fade, fadeCol = '0,0,0') {
  ctx.save(); ctx.globalAlpha = 0.03; ctx.globalCompositeOperation = 'overlay';
  const ox = (fr * 73) % 256, oy = (fr * 151) % 256; ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
  if (fade < 1) { ctx.fillStyle = `rgba(${fadeCol},${1 - fade})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- shots ----------
const shots = [
  { d: 5, k: 'cup' }, { d: 5, k: 'pen' }, { d: 4, k: 'establish' }, { d: 4, k: 'wake' }, { d: 5, k: 'hero' },
  { d: 5, k: 'docA' }, { d: 4, k: 'docB' }, { d: 5, k: 'explode' }, { d: 4, k: 'chip' }, { d: 5, k: 'screen' },
  { d: 5, k: 'wide' }, { d: 4, k: 'care' }, { d: 5, k: 'end' }];
{ let a = 0; shots.forEach(s => { s.f0 = a; s.n = s.d * FPS; a += s.n; }); }
const B_TOWER = [0, 12, 3, 18], B_HOME = [3.0, 1.2, -2.0, 11.5], B_PEN = [0.6, 1.5, 1.2, 9.5], B_MOD = [0, 0.6, 0, 3.2];
const dist = (a, b) => len(sub(a, b));
const S0 = [0, 22, 1.5], SN = [0, 0.6, 0.8];

function shotParams(k, t, sec, gsec) {
  const u = { t: gsec };
  if (k === 'cup') {
    const c = cupHand(gsec, 0.05);
    Object.assign(u, { scene: 2, bound: B_HOME, key: 1, rip: 0.02 + 0.008 * Math.sin(gsec * 3), cup: c.cup, groups: c.groups,
      ro: lerp3([8.2, 3.4, 8.4], [7.2, 3.2, 7.4], easeIO(t)), ta: [1.0, 1.8, 0.2], zoom: 1.7, aper: 10, expo: 1.05, ss: 1.0 });
    u.focus = dist(u.ro, [1.0, 2.0, 0.8]);
  }
  if (k === 'pen') {
    const n = Math.floor(SPIRAL.length * lerp(0.25, 0.95, easeIO(t)));
    drawPaper(n); uploadCanvas(1, tPap, papC);
    const ph = penHand(gsec, n);
    Object.assign(u, { scene: 3, bound: [ph.tip[0] + 1.5, 1.5, ph.tip[2] + 1.0, 9.0], key: 1, groups: ph.groups, pen0: ph.pen0, pen1: ph.pen1,
      ro: lerp3([-7.0, 6.2, 8.8], [-6.0, 5.6, 7.8], easeIO(t)), ta: [0.6, 1.0, 0.6], zoom: 1.55, aper: 12, expo: 1.0, ss: 1.0 });
    u.focus = dist(u.ro, ph.tip);
  }
  const clinic = (o) => Object.assign(u, { scene: 1, bound: B_TOWER, key: 1, expo: 0.78, bar: 1, scr: 1 }, o);
  if (k === 'establish') { clinic({ ro: lerp3([-24, 17, 47], [-20.5, 15.8, 41], easeIO(t)), ta: [0, 13.5, 0], zoom: 1.7, aper: 5, bar: 0, scr: 0 }); u.focus = dist(u.ro, [0, 14, 2]); ui('off', t, sec, 0); }
  if (k === 'wake') {
    clinic({ ro: lerp3([9.5, 21.4, 10.5], [7.2, 21.1, 9.6], easeIO(t)), ta: [-3.5, 19.8, 5.0], zoom: 2.3, aper: 24, bar: ease(ramp(t, 0.12, 0.45)), scr: ease(ramp(t, 0.4, 0.7)) });
    u.focus = lerp(dist(u.ro, [3.5, 19.8, 5]), dist(u.ro, [-3.5, 19.8, 5]), easeIO(ramp(t, 0.2, 0.85))); ui('boot', ramp(t, 0.4, 1), sec, 0);
  }
  if (k === 'hero') { const a = lerp(-0.52, -0.22, easeIO(t)); clinic({ ro: [Math.sin(a) * 44, 9.5, Math.cos(a) * 44 + 3], ta: [0, 13.5, 1], zoom: 1.6, aper: 6 }); u.focus = dist(u.ro, [0, 14, 2]); ui('home', t, sec, 0); }
  if (k === 'docA') {
    const pose = easeIO(ramp(t, 0.1, 0.62));
    const G = patientHands(gsec, pose, 0.6 * pose);
    const docIn = ease(ramp(t, 0.0, 0.25)) * (1 - ease(ramp(t, 0.8, 1)));
    const wR = lerp3([3.5, 16.3, 9.6], [3.5, 21.0, 5.85], pose); const armR = norm([0.22, -0.14 - lerp(0.55, 0, pose) * 0.4, 1]);
    const C = add(add(wR, mul(armR, 2.6)), [0.2, 1.0, 0]);
    const D = doctorHand(add(C, [lerp(6, 0, docIn), lerp(1.5, 0, docIn), 0]));
    clinic({ groups: [...G, ...D], ro: lerp3([17, 27.5, 23], [15, 26.6, 20.5], easeIO(t)), ta: [1.5, 20.4, 6], zoom: 2.0, aper: 14, ss: 1.0, beam: ease(ramp(t, 0.62, 0.8)), beamH: 0.92 });
    u.focus = dist(u.ro, [3.0, 21, 6.5]); ui(t > 0.7 ? 'live' : 'home', t, sec, ease(ramp(t, 0.7, 0.9)));
  }
  if (k === 'docB') {
    clinic({ groups: patientHands(gsec, 1, 0.6), ro: lerp3([6.2, 22.5, 13.6], [5.2, 22.2, 12.4], easeIO(t)), ta: [0.4, 20.8, 4.0], zoom: 2.05, aper: 22, ss: 1.0, beam: 1, beamH: 0.92 });
    u.focus = lerp(dist(u.ro, [3.5, 20.9, 5.0]), dist(u.ro, S0), easeIO(ramp(t, 0.35, 0.8))); ui('live', t, sec + 6, 1);
  }
  if (k === 'explode') { const a = lerp(0.5, 0.95, easeIO(t)); Object.assign(u, { scene: 0, bound: B_MOD, key: 1, bar: 1, explode: easeIO(ramp(t, 0.08, 0.68)),
      ro: [Math.sin(a) * 9.5, 3.4, Math.cos(a) * 9.5], ta: [0, 0.7, 0], zoom: lerp(2.1, 1.55, easeIO(ramp(t, 0.05, 0.7))), aper: 4, expo: 1.0 }); u.focus = dist(u.ro, u.ta); }
  if (k === 'chip') { const kk = easeIO(t); Object.assign(u, { scene: 0, bound: B_MOD, key: 1, bar: 1, explode: 1, ro: lerp3([2.6, 0.82, 2.8], [1.35, 0.72, 1.55], kk), ta: [0, 0.4, 0], zoom: lerp(2.0, 2.4, kk), aper: 16, expo: 1.0 });
    u.focus = dist(u.ro, [0, 0.42, 0]); }
  if (k === 'screen') { const ro = add(add(S0, mul(SN, lerp(13.5, 9.5, easeIO(t)))), [lerp(3.5, 1.2, easeIO(t)), 0, 0]); clinic({ ro, ta: S0, zoom: 1.65, aper: 9 }); u.focus = dist(ro, S0); ui('report', t, sec, 1); }
  if (k === 'wide') { clinic({ ro: lerp3([25, 15.5, 41], [21.5, 14.6, 35.5], easeIO(t)), ta: [0, 13, 0], zoom: 1.75, aper: 5 }); u.focus = dist(u.ro, [0, 14, 2]); ui('report', 1, sec, 1); }
  if (k === 'care') {
    const fr = frame([0, 0, -1], [0, 1, 0], true);
    const P = buildHand({ W: [1.75, 19.55 + 0.2 * HS + 0.02, 6.4], ...fr, s: HS, curls: [[0.2, 0.25, 0.1], [0.22, 0.27, 0.12], [0.25, 0.3, 0.14], [0.28, 0.3, 0.15], [0.1, 0.15, 0.1]],
      arm: norm([0.2, -0.05, 1]), armLen: 12, sleeve: 1.7, sleeveR: 0.42, skin: SKIN_P, sleeveMat: KNIT }).groups;
    const settle = ease(ramp(t, 0.05, 0.45));
    const D = doctorHand([1.6 + lerp(4, 0, settle), 20.5 + lerp(1.2, 0, settle), 5.6], { curls: [[0.18, 0.2, 0.1], [0.2, 0.22, 0.1], [0.22, 0.24, 0.12], [0.25, 0.25, 0.12], [0.1, 0.12, 0.1]] });
    clinic({ groups: [...P, ...D], ro: lerp3([10.5, 23.8, 13.5], [9.3, 23.2, 12.2], easeIO(t)), ta: [1.8, 20.0, 5.6], zoom: 2.3, aper: 22, key: 1.05, ss: 1.0 });
    u.focus = dist(u.ro, [1.75, 20.4, 5.6]); ui('report', 1, sec, 1);
  }
  if (k === 'end') { clinic({ ro: lerp3([2, 15, 58], [2, 15, 54], t), ta: [9, 12.5, 0], zoom: 1.75, aper: 4 }); u.focus = dist(u.ro, [0, 13, 2]); ui('home', t, sec, 0); }
  if (u.scene === 1) uploadCanvas(0, tScr, scrC);
  return u;
}
const MOD_LABELS = [['OPTICAL WINDOW', [0.95, 3.15, 0.2]], ['LIGHT RING', [-1.1, 2.67, 0.2]], ['LENS', [0.7, 1.9, 0.2]], ['LENS BARREL', [-0.9, 1.2, 0.3]],
  ['SENSOR BOARD', [0.95, 0.35, 0.2]], ['SIGNAL PROCESSOR', [0, 0.44, 0], 1], ['ALUMINIUM HOUSING', [-1.15, -0.95, 0.3]]];
function labels(s, a) {
  if (a <= 0) return;
  MOD_LABELS.forEach(([name, P, force], i) => { const ai = a * ease(clamp(a * 1.6 - i * 0.07)); if (ai <= 0) return;
    const [x, y] = project(s, P); const right = force ? true : x > W * 0.5; const ex = force ? x + 420 : right ? x + 100 : x - 100;
    ctx.save(); ctx.globalAlpha = ai; ctx.strokeStyle = 'rgba(57,198,232,0.85)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, y); ctx.stroke();
    ctx.fillStyle = '#39c6e8'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); ctx.restore();
    text(name, right ? ex + 12 : ex - 12, y, 17, { a: ai * 0.9, ls: 4, align: right ? 'left' : 'right' }); });
}
function chipHUD(t, sec) {
  const a = ease(ramp(t, 0.45, 0.7)); if (a <= 0) return;
  const x = 1200, y = 330, w = 580, h = 280;
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(5,10,14,0.55)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(57,198,232,0.4)'; ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); for (let i = 0; i <= w; i += 2) { const tt = sec - (w - i) / 300; const v = Math.sin(tt * TAU * 5.1) * 0.75 + Math.sin(tt * TAU * 11.3) * 0.1;
    const yy = y + h / 2 - v * h * 0.33; i ? ctx.lineTo(x + i, yy) : ctx.moveTo(x + i, yy); }
  ctx.strokeStyle = '#39c6e8'; ctx.lineWidth = 2.2; ctx.shadowColor = '#39c6e8'; ctx.shadowBlur = 10; ctx.stroke(); ctx.restore();
  text('NON-CONTACT OPTICAL SENSING', x, y - 30, 16, { align: 'left', a: a * 0.75, ls: 4 });
  text('0.01 mm', x, y + h + 58, 54, { align: 'left', a, w: 200, ls: 2 });
  text('RESOLUTION', x + 250, y + h + 60, 16, { align: 'left', a: a * 0.75, ls: 4, color: '57,198,232' });
}

async function renderFrame(fr) {
  const s = shots.find(x => fr >= x.f0 && fr < x.f0 + x.n);
  const lf = fr - s.f0, t = lf / (s.n - 1), sec = lf / FPS, gsec = fr / FPS, k = s.k;
  const FIN = { cup: 12, pen: 6, establish: 8, explode: 6, wide: 6, end: 6, docA: 5 }, FOUT = { pen: 6, chip: 6, hero: 4, care: 8, end: 14 };
  let fade = 1; if (FIN[k]) fade = Math.min(fade, (lf + 1) / FIN[k]); if (FOUT[k]) fade = Math.min(fade, (s.n - lf - 1) / FOUT[k]); fade = clamp(fade);
  const u = shotParams(k, t, sec, gsec);
  await drawGL(u);
  ctx.drawImage(glc, 0, 0);
  bloom(u.scene === 0 ? 0.4 : u.scene === 1 ? 0.08 : 0.22);
  if (k === 'establish') { const a = ease(ramp(t, 0.25, 0.5)) * (1 - ease(ramp(t, 0.85, 1))); }
  if (k === 'hero') { const a = ease(ramp(t, 0.45, 0.7)); text(NAME, W / 2, H * 0.86, 62, { w: 200, a, ls: 28, color: '30,36,42' }); text(SUB, W / 2, H * 0.86 + 56, 17, { w: 400, a: a * 0.8, ls: 9, color: '42,111,134' }); }
  if (k === 'explode') labels(u, ease(ramp(t, 0.62, 0.8)));
  if (k === 'chip') chipHUD(t, sec);
  if (k === 'wide') { const a = ease(ramp(t, 0.3, 0.55)); text('OBJECTIVE  ·  QUANTIFIED  ·  CLINICAL-GRADE', W / 2, H * 0.9, 22, { w: 400, a, ls: 10, color: '30,36,42' }); }
  if (k === 'end') { const a = ease(ramp(t, 0.1, 0.4)); text(NAME, W * 0.7, H * 0.44, 78, { w: 200, a, ls: 30, color: '28,32,38' });
    ctx.fillStyle = `rgba(42,111,134,${a})`; ctx.fillRect(W * 0.7 - 110, H * 0.44 + 62, 220, 1.5);
    text(SUB, W * 0.7, H * 0.44 + 108, 18, { w: 400, a: a * 0.85, ls: 9, color: '60,70,80' });
    text('Reg. No. XXXXXXXX  ·  For professional medical use', W / 2, H - 46, 14, { w: 400, a: a * 0.6, ls: 2, color: '70,75,80' }); }
  finish(fr, fade, k === 'end' ? '255,255,255' : '0,0,0');
}

// ---------- audio ----------
async function makeAudio() {
  const SR = 48000, ac = new OfflineAudioContext(2, SR * 60, SR);
  const master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
  const rev = ac.createConvolver(); { const n = SR * 3.4, b = ac.createBuffer(2, n, SR); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.0); } rev.buffer = b; }
  const revG = ac.createGain(); revG.gain.value = 0.34; rev.connect(revG).connect(master);
  const bus = (g = 1) => { const n = ac.createGain(); n.gain.value = g; n.connect(master); n.connect(rev); return n; };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const noiseBuf = (() => { const b = ac.createBuffer(1, SR * 2, SR), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  function piano(t, m, v = 0.16, dur = 3.5) { const g = ac.createGain(); g.connect(bus(1));
    [[1, 1], [2, 0.35], [3, 0.12], [4.01, 0.06]].forEach(([h, a]) => { const o = ac.createOscillator(); o.frequency.value = mtof(m) * h; const og = ac.createGain();
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(v * a, t + 0.008); og.gain.exponentialRampToValueAtTime(0.0001, t + dur / h); o.connect(og).connect(g); o.start(t); o.stop(t + dur); }); }
  function pad(t0, t1, notes, v, at = 2, rel = 2.5) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.3;
    const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + at); g.gain.setValueAtTime(v, t1); g.gain.linearRampToValueAtTime(0, t1 + rel); lp.connect(g).connect(bus(1));
    notes.forEach((m, i) => [-6, 6].forEach(det => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det + i; const og = ac.createGain(); og.gain.value = 0.045; o.connect(og).connect(lp); o.start(t0); o.stop(t1 + rel + 0.1); })); }
  function subHit(t, v = 0.7) { const o = ac.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(32, t + 1.4); const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 2.2); o.connect(g).connect(master); o.start(t); o.stop(t + 2.3); }
  function noise(t, dur, f0, f1, v, q = 1.2) { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f).connect(g).connect(bus(0.8)); s.start(t); s.stop(t + dur + 0.05); }
  function click(t, f = 2200, v = 0.25, d = 0.05) { const s = ac.createBufferSource(); s.buffer = noiseBuf; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 4;
    const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); s.connect(bp).connect(g).connect(bus(1)); s.start(t); s.stop(t + d + 0.02); }
  function chime(t, m, v = 0.06) { [1, 2.76, 5.4].forEach((h, i) => { const o = ac.createOscillator(); o.frequency.value = mtof(m) * h; const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v / (i + 1), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2 / (i + 1)); o.connect(g).connect(bus(1)); o.start(t); o.stop(t + 2.4); }); }
  function glass(t, v = 0.07) { [2630, 5390, 8120].forEach((f, i) => { const o = ac.createOscillator(); o.frequency.value = f; const g = ac.createGain(); g.gain.setValueAtTime(v / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 / (i + 1)); o.connect(g).connect(bus(1)); o.start(t); o.stop(t + 1); }); }
  // opening: sparse piano + low pad (cup, pen)
  [[0.5, 69], [2.0, 72], [3.5, 76], [5.2, 74], [6.8, 72], [8.4, 69]].forEach(([t, m]) => piano(t, m, 0.12, 4)); [[0.5, 45], [5.2, 41]].forEach(([t, m]) => piano(t, m, 0.11, 6));
  pad(0.3, 9.6, [57, 64, 69], 0.09, 3, 1.5); [1.4, 2.9, 4.1].forEach(t => glass(t)); noise(5.3, 4.4, 3200, 2800, 0.025, 0.8);
  // clinic: lift
  noise(9.3, 1.0, 400, 5000, 0.14, 0.9); subHit(10.0, 0.55);
  const prog = [[10, [45, 57, 64, 71]], [14, [41, 57, 65, 72]], [18, [48, 55, 64, 72]], [23, [43, 55, 62, 71]], [28, [45, 57, 64, 72]], [32, [41, 57, 65, 69]], [37, [48, 55, 64, 71]], [41, [43, 55, 62, 67]], [46, [41, 57, 65, 72]], [51, [45, 57, 64, 69]], [55, [48, 55, 64, 67]]];
  prog.forEach(([t, ch], i) => { const nx = (prog[i + 1] || [59.5])[0]; pad(t, nx - 0.2, ch, i >= 8 ? 0.15 : 0.12, 1.2, 1.6);
    for (let b = 0; b < (nx - t) / 0.625; b++) { const bt = t + b * 0.625; piano(bt, ch[1 + (b % 3)] + 12, 0.04 + (i >= 8 ? 0.015 : 0), 1.6); } });
  chime(14.6, 81); chime(15.1, 85); chime(15.6, 88); chime(16.0, 93, 0.05);
  subHit(18.0, 0.6); noise(17.4, 0.8, 600, 3000, 0.05);
  for (let i = 0; i < 10; i++) click(26.5 + i * 0.12, 5200, 0.03, 0.02);
  noise(31.4, 0.8, 4000, 500, 0.08); subHit(32.0, 0.5);
  for (let i = 0; i < 7; i++) click(32.6 + i * 0.32, 1800 + i * 150, 0.22);
  for (let i = 0; i < 16; i++) click(37.6 + i * 0.22, 5200, 0.05, 0.02);
  [41.4, 42.2, 43.0].forEach(t => chime(t, 88, 0.035));
  noise(45.5, 1.0, 600, 3000, 0.05);
  [72, 76, 79, 76, 74, 72].forEach((m, i) => piano(51.2 + i * 0.7, m, 0.11, 4)); piano(55.1, 72, 0.12, 6); piano(55.1, 48, 0.13, 6);
  subHit(55.0, 0.5); piano(55.2, 84, 0.07, 4);
  master.gain.setValueAtTime(0.8, 57.8); master.gain.linearRampToValueAtTime(0.0, 60);
  const buf = await ac.startRendering(); const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); const gn = peak > 0 ? 0.89 / peak : 1;
  const pcm = new Int16Array(L.length * 2); for (let i = 0; i < L.length; i++) { pcm[2 * i] = clamp(L[i] * gn, -1, 1) * 32767; pcm[2 * i + 1] = clamp(R[i] * gn, -1, 1) * 32767; }
  return new Uint8Array(pcm.buffer);
}

// ---------- driver ----------
window.state = { frame: 0, done: false, err: null, t0: 0 };
window.preview = async fr => { await renderFrame(fr); };
window.timeFrame = async fr => { const a = performance.now(); await renderFrame(fr); return performance.now() - a; };
window.run = async (from = 0, to = TOTAL) => {
  try {
    state.t0 = performance.now(); const samples = []; let avcC = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC) avcC = new Uint8Array(meta.decoderConfig.description);
      const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); samples.push({ data: d, key: chunk.type === 'key', ts: chunk.timestamp }); }, error: e => state.err = String(e) });
    enc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 14_000_000, framerate: FPS, avc: { format: 'avc' }, latencyMode: 'quality' });
    state.audio = makeAudio();
    for (let fr = from; fr < to; fr++) {
      state.frame = fr; await renderFrame(fr);
      const vf = new VideoFrame(out, { timestamp: Math.round(fr * 1e6 / FPS), duration: Math.round(1e6 / FPS) }); enc.encode(vf, { keyFrame: fr % 50 === 0 }); vf.close();
      while (enc.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 5));
    }
    await enc.flush(); enc.close(); samples.sort((a, b) => a.ts - b.ts);
    const pcm = await state.audio; Object.assign(state, { samples, avcC, pcm, W, H, DUR: DUR_MS });
    state.blob = buildMov(samples, avcC, pcm); state.wav = wav(pcm); state.done = true; state.secs = (performance.now() - state.t0) / 1000;
  } catch (e) { state.err = e.stack || String(e); }
};
document.getElementById('log').textContent = 'ready';
