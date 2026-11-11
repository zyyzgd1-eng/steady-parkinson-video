// Make a small preview by demuxing the finished 1080p MP4 (picked via file input) and re-encoding at lower size
function parseVideoTrack(buf) {
  const d = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const type = o => String.fromCharCode(buf[o + 4], buf[o + 5], buf[o + 6], buf[o + 7]);
  const find = (o, e, t) => { while (o < e) { const sz = d.getUint32(o); if (type(o) === t) return [o, o + sz]; o += sz; } return null; };
  const moov = find(0, buf.length, 'moov');
  let o = moov[0] + 8; let trak;
  while (o < moov[1]) { const sz = d.getUint32(o); if (type(o) === 'trak') { const md = find(o + 8, o + sz, 'mdia'); const hd = find(md[0] + 8, md[1], 'hdlr');
    if (String.fromCharCode(...buf.subarray(hd[0] + 16, hd[0] + 20)) === 'vide') { trak = [o, o + sz]; break; } } o += sz; }
  const mdia = find(trak[0] + 8, trak[1], 'mdia'), minf = find(mdia[0] + 8, mdia[1], 'minf'), stbl = find(minf[0] + 8, minf[1], 'stbl');
  const stsd = find(stbl[0] + 8, stbl[1], 'stsd'); const avc1 = stsd[0] + 16; const avcC = find(avc1 + 8 + 78, avc1 + d.getUint32(avc1), 'avcC');
  const desc = buf.slice(avcC[0] + 8, avcC[1]);
  const stsz = find(stbl[0] + 8, stbl[1], 'stsz'), stco = find(stbl[0] + 8, stbl[1], 'stco'), stss = find(stbl[0] + 8, stbl[1], 'stss');
  const n = d.getUint32(stsz[0] + 16); const keys = new Set(); for (let i = 0; i < d.getUint32(stss[0] + 12); i++) keys.add(d.getUint32(stss[0] + 16 + i * 4) - 1);
  const s = []; for (let i = 0; i < n; i++) { const size = d.getUint32(stsz[0] + 20 + i * 4), off = d.getUint32(stco[0] + 16 + i * 4); s.push({ data: buf.subarray(off, off + size), key: keys.has(i) }); }
  return { desc, samples: s };
}
window.makePreview = async function (PW = 960, PH = 540, vbr = 900_000) {
  const file = document.getElementById('srcfile').files[0];
  const buf = new Uint8Array(await file.arrayBuffer());
  const { desc, samples: src } = parseVideoTrack(buf);
  const c = document.createElement('canvas'); c.width = PW; c.height = PH; const g = c.getContext('2d');
  const samples = []; let avcC = null;
  const enc = new VideoEncoder({ output: (ch, m) => { if (m && m.decoderConfig && m.decoderConfig.description && !avcC) avcC = new Uint8Array(m.decoderConfig.description);
    const dd = new Uint8Array(ch.byteLength); ch.copyTo(dd); samples.push({ data: dd, key: ch.type === 'key', ts: ch.timestamp }); }, error: e => { state.perr = String(e); } });
  enc.configure({ codec: 'avc1.64001f', width: PW, height: PH, bitrate: vbr, framerate: 25, avc: { format: 'avc' }, latencyMode: 'quality' });
  let idx = 0;
  const dec = new VideoDecoder({ output: fr => { g.drawImage(fr, 0, 0, PW, PH); fr.close();
    const f = new VideoFrame(c, { timestamp: idx * 40000, duration: 40000 }); enc.encode(f, { keyFrame: idx % 50 === 0 }); f.close(); idx++; state.pframe = idx; }, error: e => { state.perr = String(e); } });
  dec.configure({ codec: 'avc1.640028', description: desc, codedWidth: 1920, codedHeight: 1080 });
  for (let i = 0; i < src.length; i++) {
    dec.decode(new EncodedVideoChunk({ type: src[i].key ? 'key' : 'delta', timestamp: i * 40000, duration: 40000, data: src[i].data }));
    while (dec.decodeQueueSize > 8 || enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 2));
  }
  await dec.flush(); await enc.flush(); enc.close(); dec.close(); samples.sort((a, b) => a.ts - b.ts);
  const pcm = await makeAudio();
  Object.assign(state, { samples, avcC, pcm, W: PW, H: PH, ABR: 96000 });
  return idx;
};
