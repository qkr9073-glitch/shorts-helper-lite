import { Mp3Encoder } from "@breezystack/lamejs";

export type OutputFormat = "mp3" | "wav";

export type SilenceOptions = {
  thresholdDb: number;      // e.g. 45 → silence under -45 dBFS
  maxSilenceSec: number;    // keep this much silence between kept regions
  output: OutputFormat;
  onProgress?: (p: number) => void;
};

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ab = await file.arrayBuffer();
  const Ctx: typeof AudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(ab.slice(0));
  } finally {
    if (ctx.state !== "closed") ctx.close();
  }
}

function detectNonSilentRegions(buf: AudioBuffer, thresholdDb: number, maxSilenceSec: number) {
  const sr = buf.sampleRate;
  const frame = Math.max(1, Math.round(sr * 0.02)); // 20ms frames
  const thresh = Math.pow(10, -Math.abs(thresholdDb) / 20); // linear amplitude
  const ch = buf.numberOfChannels;
  const data: Float32Array[] = [];
  for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));

  const nFrames = Math.floor(buf.length / frame);
  const voiced: boolean[] = new Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    const start = i * frame;
    let sum = 0;
    for (let c = 0; c < ch; c++) {
      const d = data[c];
      for (let j = 0; j < frame; j++) {
        const v = d[start + j];
        sum += v * v;
      }
    }
    const rms = Math.sqrt(sum / (frame * ch));
    voiced[i] = rms >= thresh;
  }

  // merge short silences (shorter than maxSilenceSec) into voiced
  const maxSilFrames = Math.max(1, Math.round(maxSilenceSec / 0.02));
  let i = 0;
  while (i < nFrames) {
    if (!voiced[i]) {
      let j = i;
      while (j < nFrames && !voiced[j]) j++;
      const len = j - i;
      // keep up to maxSilFrames of silence; mark extra as drop later
      if (len <= maxSilFrames) {
        for (let k = i; k < j; k++) voiced[k] = true; // keep short silences
      } else {
        // keep first half of maxSilFrames from each side's edge silence → simpler: keep maxSilFrames centered
        const keep = maxSilFrames;
        const dropStart = i + Math.floor(keep / 2);
        const dropEnd = j - Math.ceil(keep / 2);
        for (let k = i; k < dropStart; k++) voiced[k] = true;
        for (let k = dropStart; k < dropEnd; k++) voiced[k] = false;
        for (let k = dropEnd; k < j; k++) voiced[k] = true;
      }
      i = j;
    } else i++;
  }

  // build regions (sample ranges) of voiced
  const regions: { start: number; end: number }[] = [];
  let k = 0;
  while (k < nFrames) {
    if (voiced[k]) {
      let m = k;
      while (m < nFrames && voiced[m]) m++;
      regions.push({ start: k * frame, end: Math.min(buf.length, m * frame) });
      k = m;
    } else k++;
  }
  return regions;
}

function spliceBuffer(buf: AudioBuffer, regions: { start: number; end: number }[]): AudioBuffer {
  const ch = buf.numberOfChannels;
  const totalLen = regions.reduce((s, r) => s + (r.end - r.start), 0);
  const Ctx: typeof AudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new Ctx();
  const out = ctx.createBuffer(ch, Math.max(1, totalLen), buf.sampleRate);
  ctx.close();
  for (let c = 0; c < ch; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    let off = 0;
    for (const r of regions) {
      dst.set(src.subarray(r.start, r.end), off);
      off += r.end - r.start;
    }
  }
  return out;
}

function encodeWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const len = buf.length;
  const bytesPerSample = 2;
  const blockAlign = ch * bytesPerSample;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); w(8, "WAVE");
  w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * blockAlign, true); v.setUint16(32, blockAlign, true);
  v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, dataSize, true);
  let off = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < ch; c++) channels.push(buf.getChannelData(c));
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      v.setInt16(off, s, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

function encodeMp3(buf: AudioBuffer, onProgress?: (p: number) => void): Blob {
  const ch = Math.min(2, buf.numberOfChannels);
  const sr = buf.sampleRate;
  const kbps = 192;
  const enc = new Mp3Encoder(ch, sr, kbps);
  const chunkSize = 1152;
  const len = buf.length;
  const toInt16 = (f: Float32Array): Int16Array => {
    const out = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) {
      const s = Math.max(-1, Math.min(1, f[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };
  const left = toInt16(buf.getChannelData(0));
  const right = ch === 2 ? toInt16(buf.getChannelData(1)) : null;
  const parts: Uint8Array[] = [];
  for (let i = 0; i < len; i += chunkSize) {
    const l = left.subarray(i, i + chunkSize);
    const enc1 = right ? enc.encodeBuffer(l, right.subarray(i, i + chunkSize)) : enc.encodeBuffer(l);
    if (enc1.length) parts.push(enc1);
    if (onProgress && (i % (chunkSize * 50) === 0)) onProgress(0.5 + 0.5 * (i / len));
  }
  const tail = enc.flush();
  if (tail.length) parts.push(tail);
  return new Blob(parts as BlobPart[], { type: "audio/mpeg" });
}

export async function removeSilence(file: File, opts: SilenceOptions): Promise<{ blob: Blob; origSec: number; outSec: number }> {
  opts.onProgress?.(0.05);
  const buf = await decodeAudioFile(file);
  opts.onProgress?.(0.2);
  const regions = detectNonSilentRegions(buf, opts.thresholdDb, opts.maxSilenceSec);
  opts.onProgress?.(0.35);
  const out = spliceBuffer(buf, regions);
  opts.onProgress?.(0.5);
  const blob = opts.output === "mp3" ? encodeMp3(out, opts.onProgress) : encodeWav(out);
  opts.onProgress?.(1);
  return { blob, origSec: buf.duration, outSec: out.duration };
}
