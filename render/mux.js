// shared container writers (uses globals W, H, FPS, DUR_MS)
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
  const durMs = DUR_MS, vN = vSamples.length, aN = pcm.length / 4;
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


function wav(pcm) { const h = new DataView(new ArrayBuffer(44)); const w = (o, s) => [...s].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); h.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 2, true);
  h.setUint32(24, 48000, true); h.setUint32(28, 192000, true); h.setUint16(32, 4, true); h.setUint16(34, 16, true); w(36, 'data'); h.setUint32(40, pcm.length, true);
  return new Blob([h, pcm], { type: 'audio/wav' }); }

window.download = (which, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(state[which]); a.download = name; document.body.appendChild(a); a.click(); };
