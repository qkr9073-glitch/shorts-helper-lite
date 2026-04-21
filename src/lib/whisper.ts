import {
  pipeline,
  env,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

export type WhisperModel = "tiny" | "base" | "small" | "medium";

export const MODEL_INFO: Record<
  WhisperModel,
  { id: string; sizeMB: number; label: string; desc: string }
> = {
  tiny:   { id: "Xenova/whisper-tiny",   sizeMB: 40,  label: "tiny (초고속)",   desc: "40MB · 매우 빠름 · 정확도 낮음" },
  base:   { id: "Xenova/whisper-base",   sizeMB: 80,  label: "base (빠름)",     desc: "80MB · 빠름 · 정확도 보통" },
  small:  { id: "Xenova/whisper-small",  sizeMB: 250, label: "small (추천) ⭐", desc: "250MB · 보통 · 한국어 정확도 좋음" },
  medium: { id: "Xenova/whisper-medium", sizeMB: 770, label: "medium (고정확)", desc: "770MB · 느림 · 정확도 매우 좋음" },
};

export type Chunk = { text: string; timestamp: [number, number | null] };

export type TranscribeResult = {
  text: string;
  chunks: Chunk[];
};

export type LoadProgress = {
  file?: string;
  loaded: number;
  total: number;
  progress: number;
};

const TARGET_SAMPLE_RATE = 16000;

export async function decodeAudio(
  file: File,
  onProgress?: (p: number) => void,
): Promise<{ samples: Float32Array; duration: number }> {
  onProgress?.(0.05);
  const arr = await file.arrayBuffer();
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(arr);
  } catch {
    throw new Error("오디오 디코딩 실패 — 브라우저가 이 파일 코덱을 지원하지 않아요. mp3/wav/mp4/m4a로 변환 후 다시 시도하세요.");
  } finally {
    ctx.close();
  }
  onProgress?.(0.4);

  const length = Math.ceil(buffer.duration * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, length, TARGET_SAMPLE_RATE);
  const src = offline.createBufferSource();

  if (buffer.numberOfChannels === 1) {
    src.buffer = buffer;
  } else {
    const mono = offline.createBuffer(1, buffer.length, buffer.sampleRate);
    const out = mono.getChannelData(0);
    const chs: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chs.push(buffer.getChannelData(c));
    for (let i = 0; i < buffer.length; i++) {
      let s = 0;
      for (let c = 0; c < chs.length; c++) s += chs[c][i];
      out[i] = s / chs.length;
    }
    src.buffer = mono;
  }
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  onProgress?.(1);
  return { samples: rendered.getChannelData(0), duration: buffer.duration };
}

let cached: { model: WhisperModel; pipe: AutomaticSpeechRecognitionPipeline } | null = null;

export async function loadWhisper(
  model: WhisperModel,
  onProgress?: (p: number, file?: string) => void,
  useWebGPU = true,
): Promise<AutomaticSpeechRecognitionPipeline> {
  if (cached && cached.model === model) return cached.pipe;
  const info = MODEL_INFO[model];
  const byFile: Record<string, number> = {};

  const opts = {
    device: useWebGPU ? "webgpu" : "wasm",
    progress_callback: (p: unknown) => {
      const ev = p as { status?: string; file?: string; loaded?: number; total?: number };
      if (ev.status === "progress" && ev.file && ev.total) {
        byFile[ev.file] = (ev.loaded || 0) / ev.total;
      } else if (ev.status === "done" && ev.file) {
        byFile[ev.file] = 1;
      }
      const vals = Object.values(byFile);
      if (vals.length) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        onProgress?.(avg, ev.file);
      }
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelineAny = pipeline as unknown as (...args: any[]) => Promise<AutomaticSpeechRecognitionPipeline>;
  const pipe = await pipelineAny("automatic-speech-recognition", info.id, opts);

  cached = { model, pipe };
  return pipe;
}

export async function transcribe(
  pipe: AutomaticSpeechRecognitionPipeline,
  samples: Float32Array,
  language: string = "korean",
): Promise<TranscribeResult> {
  const out = await pipe(samples, {
    language,
    task: "transcribe",
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  } as never) as { text: string; chunks?: Chunk[] };
  return { text: out.text || "", chunks: out.chunks || [] };
}

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}
function fmtTime(sec: number, sep = ",") {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  const s = Math.floor(sec) % 60;
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms, 3)}`;
}

export function toPlainText(chunks: Chunk[]): string {
  return chunks.map(c => c.text.trim()).filter(Boolean).join("\n");
}

export function toSRT(chunks: Chunk[]): string {
  return chunks.map((c, i) => {
    const start = c.timestamp[0] ?? 0;
    const end = c.timestamp[1] ?? start + 2;
    return `${i + 1}\n${fmtTime(start, ",")} --> ${fmtTime(end, ",")}\n${c.text.trim()}\n`;
  }).join("\n");
}

export function toVTT(chunks: Chunk[]): string {
  const body = chunks.map(c => {
    const start = c.timestamp[0] ?? 0;
    const end = c.timestamp[1] ?? start + 2;
    return `${fmtTime(start, ".")} --> ${fmtTime(end, ".")}\n${c.text.trim()}\n`;
  }).join("\n");
  return `WEBVTT\n\n${body}`;
}

export function resetCache() {
  cached = null;
}
