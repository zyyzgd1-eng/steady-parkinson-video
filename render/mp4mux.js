// MP4 (ISO BMFF) muxer: H.264 video + Opus audio + tx3g Chinese subtitle track, moov in front (fast start)
window.buildMp4 = async function (srtText) {
  const { samples, avcC, pcm } = state;
  const W = state.W || 1920, H = state.H || 1080, FPS = 25, DUR = state.DUR || 60000;
  // ---- Opus encode ----
  const aChunks = []; let aDesc = null;
  const ae = new AudioEncoder({ output: (c, m) => { if (m && m.decoderConfig && m.decoderConfig.description && !aDesc) aDesc = new Uint8Array(m.decoderConfig.description);
    const d = new Uint8Array(c.byteLength); c.copyTo(d); aChunks.push({ data: d, ts: c.timestamp, dur: c.duration }); }, error: e => { throw e; } });
  ae.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: state.ABR || 192000 });
  const i16 = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2), frames = i16.length / 2, STEP = 4800;
  for (let o = 0; o < frames; o += STEP) {
    const n = Math.min(STEP, frames - o);
    ae.encode(new AudioData({ format: 's16', sampleRate: 48000, numberOfChannels: 2, numberOfFrames: n, timestamp: Math.round(o * 1e6 / 48000), data: i16.slice(o * 2, (o + n) * 2) }));
  }
  await ae.flush(); ae.close();
  let preSkip = 312; if (aDesc && aDesc.length >= 12) preSkip = aDesc[10] | (aDesc[11] << 8);
  const aDurs = aChunks.map(c => Math.round((c.dur || 20000) * 48000 / 1e6));
  // ---- subtitles ----
  const enc = new TextEncoder();
  const cues = srtText.replace(/\r/g, '').trim().split(/\n\n+/).map(b => { const l = b.split('\n'); const m = l[1].match(/(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)/);
    const ms = (h, mi, s, x) => ((+h * 60 + +mi) * 60 + +s) * 1000 + +x; return { a: ms(m[1], m[2], m[3], m[4]), b: ms(m[5], m[6], m[7], m[8]), t: l.slice(2).join('\n') }; });
  const sSamples = []; let cur = 0;
  const txt = s => { const b = enc.encode(s); const o = new Uint8Array(2 + b.length); o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o; };
  cues.forEach(c => { if (c.a > cur) sSamples.push({ data: txt(''), dur: c.a - cur }); sSamples.push({ data: txt(c.t), dur: c.b - c.a }); cur = c.b; });
  if (cur < DUR) sSamples.push({ data: txt(''), dur: DUR - cur });
  // ---- boxes ----
  const box = (type, ...parts) => { const body = parts.flat(Infinity).filter(p => p != null); let len = 8; body.forEach(p => len += p.length);
    const o = new Uint8Array(len); new DataView(o.buffer).setUint32(0, len); for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i); let off = 8; body.forEach(p => { o.set(p, off); off += p.length; }); return o; };
  const u8 = (...v) => new Uint8Array(v), u16 = v => u8(v >> 8 & 255, v & 255), u32 = v => u8(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
  const s4 = s => u8(...[...s].map(c => c.charCodeAt(0))), z = n => new Uint8Array(n), cstr = s => { const b = enc.encode(s); const o = new Uint8Array(b.length + 1); o.set(b); return o; };
  const MAT = [u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)];
  const rle = arr => { const r = []; arr.forEach(d => { if (r.length && r[r.length - 1][1] === d) r[r.length - 1][0]++; else r.push([1, d]); }); return r; };
  const tkhd = (id, w, h, vol, layer = 0) => box('tkhd', u32(3), u32(0), u32(0), u32(id), u32(0), u32(DUR), z(8), u16(layer), u16(0), u16(vol), u16(0), MAT, u32(w * 65536), u32(h * 65536));
  const mdhd = (ts, d) => box('mdhd', u32(0), u32(0), u32(0), u32(ts), u32(d), u16(0x55c4), u16(0));
  const hdlr = (t, n) => box('hdlr', u32(0), u32(0), s4(t), z(12), cstr(n));
  const dinf = box('dinf', box('dref', u32(0), u32(1), box('url ', u32(1))));
  const stbl = (stsd, durs, sizes, offs, stss) => box('stbl', box('stsd', u32(0), u32(1), stsd),
    box('stts', u32(0), u32(rle(durs).length), rle(durs).map(([c, d]) => [u32(c), u32(d)])),
    stss ? box('stss', u32(0), u32(stss.length), stss.map(u32)) : null,
    box('stsc', u32(0), u32(1), u32(1), u32(1), u32(1)), box('stsz', u32(0), u32(0), u32(sizes.length), sizes.map(u32)), box('stco', u32(0), u32(offs.length), offs.map(u32)));
  const comp = z(32); { const nm = 'H.264'; comp[0] = nm.length; for (let i = 0; i < nm.length; i++) comp[1 + i] = nm.charCodeAt(i); }
  const avc1 = box('avc1', z(6), u16(1), z(16), u16(W), u16(H), u32(0x480000), u32(0x480000), u32(0), u16(1), comp, u16(24), u16(0xffff), box('avcC', avcC));
  const dOps = box('dOps', u8(0, 2), u16(preSkip), u32(48000), u16(0), u8(0));
  const opus = box('Opus', z(6), u16(1), z(8), u16(2), u16(16), z(4), u32(48000 * 65536 >>> 0), dOps);
  const tx3g = box('tx3g', z(6), u16(1), u32(0x20000000 >>> 0), u8(1, 0xff), u8(0, 0, 0, 0), u16(0), u16(0), u16(H), u16(W), u16(0), u16(0), u16(1), u8(0), u8(54), u8(255, 255, 255, 255),
    box('ftab', u16(1), u16(1), u8(10), s4('Sans-Serif')));
  const parts = [{ s: samples.map(s => s.data) }, { s: aChunks.map(c => c.data) }, { s: sSamples.map(c => c.data) }];
  const build = (base) => {
    let off = base; const offs = parts.map(p => p.s.map(d => { const o = off; off += d.length; return o; }));
    const vT = box('trak', tkhd(1, W, H, 0), box('mdia', mdhd(FPS * 512, samples.length * 512), hdlr('vide', 'VideoHandler'),
      box('minf', box('vmhd', u32(1), z(8)), dinf, stbl(avc1, samples.map(() => 512), samples.map(s => s.data.length), offs[0], samples.map((s, i) => s.key ? i + 1 : 0).filter(Boolean)))));
    const aT = box('trak', tkhd(2, 0, 0, 0x100), box('mdia', mdhd(48000, aDurs.reduce((a, b) => a + b, 0)), hdlr('soun', 'SoundHandler'),
      box('minf', box('smhd', u32(0), u32(0)), dinf, stbl(opus, aDurs, aChunks.map(c => c.data.length), offs[1]))));
    const sT = box('trak', tkhd(3, W, H, 0, -1), box('mdia', mdhd(1000, DUR), hdlr('sbtl', 'SubtitleHandler'),
      box('minf', box('nmhd', u32(0)), dinf, stbl(tx3g, sSamples.map(c => c.dur), sSamples.map(c => c.data.length), offs[2]))));
    const mvhd = box('mvhd', u32(0), u32(0), u32(0), u32(1000), u32(DUR), u32(0x10000), u16(0x100), z(10), MAT, z(24), u32(4));
    return box('moov', mvhd, vT, aT, sT);
  };
  const ftyp = box('ftyp', s4('isom'), u32(512), s4('isom'), s4('iso2'), s4('avc1'), s4('mp41'));
  let mdatLen = 8; parts.forEach(p => p.s.forEach(d => mdatLen += d.length));
  const m0 = build(0); const moov = build(ftyp.length + m0.length + 8);
  const hdr = new Uint8Array(8); new DataView(hdr.buffer).setUint32(0, mdatLen); hdr.set(s4('mdat'), 4);
  state.mp4 = new Blob([ftyp, moov, hdr, ...parts.flatMap(p => p.s)], { type: 'video/mp4' });
  return { size: state.mp4.size, opusPackets: aChunks.length, preSkip, cues: cues.length };
};
