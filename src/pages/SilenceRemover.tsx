import { useCallback, useRef, useState } from "react";
import { removeSilence, type OutputFormat } from "../lib/silenceRemover";
import MobileNotice from "../components/MobileNotice";

type Item = {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  origUrl?: string;
  outUrl?: string;
  outName?: string;
  origSec?: number;
  outSec?: number;
  error?: string;
};

const ACCEPT = "audio/mpeg,audio/wav,audio/x-wav,audio/mp3,.mp3,.wav";
const MAX_DURATION_SEC = 300;
const MAX_SIZE_MB = 80;

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.src = url;
    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("오디오 파일을 읽을 수 없습니다."));
    });
  });
}

function fmtSec(s?: number) {
  if (s == null) return "-";
  const m = Math.floor(s / 60);
  const r = (s - m * 60).toFixed(1);
  return `${m}:${r.padStart(4, "0")}`;
}
function fmtSize(n: number) {
  if (n < 1024) return n + "B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + "KB";
  return (n / 1024 / 1024).toFixed(1) + "MB";
}

export default function SilenceRemover() {
  const [items, setItems] = useState<Item[]>([]);
  const [thresholdDb, setThresholdDb] = useState(45);
  const [maxSilence, setMaxSilence] = useState(0.10);
  const [output, setOutput] = useState<OutputFormat>("mp3");
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [warn, setWarn] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setWarn("");
    const rejected: string[] = [];
    const arr: Item[] = [];
    for (const f of Array.from(files)) {
      if (!/\.(mp3|wav)$/i.test(f.name)) { rejected.push(`${f.name} (지원하지 않는 형식)`); continue; }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) { rejected.push(`${f.name} (${(f.size/1024/1024).toFixed(1)}MB, 최대 ${MAX_SIZE_MB}MB)`); continue; }
      try {
        const dur = await probeDuration(f);
        if (dur > MAX_DURATION_SEC) { rejected.push(`${f.name} (${dur.toFixed(0)}초, 최대 ${MAX_DURATION_SEC/60}분)`); continue; }
      } catch {
        rejected.push(`${f.name} (읽기 실패)`); continue;
      }
      arr.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        status: "pending",
        progress: 0,
        origUrl: URL.createObjectURL(f),
      });
    }
    if (arr.length) setItems(s => [...s, ...arr]);
    if (rejected.length) setWarn("❌ 추가되지 않음: " + rejected.join(", "));
  }, []);

  function removeItem(id: string) {
    setItems(s => {
      const it = s.find(x => x.id === id);
      if (it?.origUrl) URL.revokeObjectURL(it.origUrl);
      if (it?.outUrl) URL.revokeObjectURL(it.outUrl);
      return s.filter(x => x.id !== id);
    });
  }
  function clearAll() {
    items.forEach(it => {
      if (it.origUrl) URL.revokeObjectURL(it.origUrl);
      if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    });
    setItems([]);
  }

  async function processAll() {
    if (running || !items.length) return;
    setRunning(true);
    for (const it of items) {
      if (it.status === "done") continue;
      setItems(s => s.map(x => x.id === it.id ? { ...x, status: "processing", progress: 0.02, error: undefined } : x));
      try {
        const { blob, origSec, outSec } = await removeSilence(it.file, {
          thresholdDb, maxSilenceSec: maxSilence, output,
          onProgress: p => setItems(s => s.map(x => x.id === it.id ? { ...x, progress: p } : x)),
        });
        const url = URL.createObjectURL(blob);
        const outName = it.file.name.replace(/\.[^.]+$/, "") + ".nosilence." + output;
        setItems(s => s.map(x => x.id === it.id ? { ...x, status: "done", progress: 1, outUrl: url, outName, origSec, outSec } : x));
      } catch (e) {
        setItems(s => s.map(x => x.id === it.id ? { ...x, status: "error", error: (e as Error).message } : x));
      }
    }
    setRunning(false);
  }

  function downloadAll() {
    items.filter(i => i.outUrl).forEach(i => {
      const a = document.createElement("a");
      a.href = i.outUrl!;
      a.download = i.outName!;
      a.click();
    });
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <MobileNotice tool="무음 제거" />
      <div className="flex items-center gap-3 mb-1">
        <span className="text-3xl">🔇</span>
        <h1 className="text-2xl font-bold text-ink">무음 제거기</h1>
      </div>
      <p className="text-ink-muted mb-3 text-[14.5px] sm:text-base">오디오 파일(mp3 / wav)에서 무음 구간을 자동으로 잘라냅니다. 파일은 브라우저에서만 처리되며 서버로 올라가지 않아요.</p>
      <div className="mb-6 text-xs bg-bg-tip border border-borderc-base text-gold-tip rounded-xl px-3 py-2 inline-block">
        ⚠️ 쇼츠 대본 편집용 — 파일당 최대 <b>{MAX_DURATION_SEC/60}분</b> · <b>{MAX_SIZE_MB}MB</b>까지 업로드 가능합니다.
      </div>
      {warn && <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{warn}</div>}

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="text-sm font-semibold text-ink mb-3">파일 목록 <span className="text-ink-soft font-normal">(드래그 앤 드롭 가능)</span></div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition ${dragOver ? "border-gold bg-bg-tip" : "border-borderc-base bg-bg-base hover:border-gold"}`}
          >
            <div className="text-4xl mb-2">🎵</div>
            <div className="text-sm text-ink-muted">클릭하거나 파일을 끌어다 놓으세요</div>
            <div className="text-xs text-ink-soft mt-1">.mp3, .wav</div>
            <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden"
                   onChange={e => e.target.files && addFiles(e.target.files)} />
          </div>

          <div className="mt-4 space-y-2 max-h-[360px] overflow-y-auto">
            {items.length === 0 && <div className="text-xs text-ink-soft text-center py-4">등록된 파일 없음</div>}
            {items.map(it => (
              <div key={it.id} className="border border-borderc-base rounded-xl p-3 bg-bg-field">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{it.file.name}</div>
                    <div className="text-xs text-ink-soft">{fmtSize(it.file.size)} · {it.status === "done" ? `${fmtSec(it.origSec)} → ${fmtSec(it.outSec)}` : it.status === "error" ? <span className="text-red-500">{it.error}</span> : it.status}</div>
                  </div>
                  <button onClick={() => removeItem(it.id)} className="text-ink-soft hover:text-red-500 text-sm px-2" title="삭제">✕</button>
                </div>
                {it.status === "processing" && (
                  <div className="mt-2">
                    <div className="flex justify-between items-center text-[11px] text-ink-muted mb-1">
                      <span>처리 중...</span>
                      <span className="text-gold font-bold">{Math.round(it.progress * 100)}%</span>
                    </div>
                    <div className="h-2.5 bg-bg-statusbar rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-gold to-gold-bright transition-all duration-300 relative"
                           style={{ width: `${Math.round(it.progress * 100)}%` }}>
                        <div className="absolute inset-0 bg-white/30 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
                {(it.origUrl || it.outUrl) && (
                  <div className="mt-2 grid gap-1.5">
                    {it.origUrl && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-12 text-ink-soft">원본</span>
                        <audio src={it.origUrl} controls className="h-8 flex-1" preload="none" />
                      </div>
                    )}
                    {it.outUrl && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-12 text-gold font-semibold">결과</span>
                        <audio src={it.outUrl} controls className="h-8 flex-1" preload="none" />
                        <a href={it.outUrl} download={it.outName} className="text-xs bg-gold text-white px-2 py-1 rounded-lg hover:bg-gold-bright">⬇</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="mt-3 flex gap-2">
              <button onClick={clearAll} className="text-xs px-3 py-1.5 rounded-lg border border-borderc-base text-ink-muted hover:bg-bg-base">전체 비우기</button>
              {items.some(i => i.outUrl) && (
                <button onClick={downloadAll} className="text-xs px-3 py-1.5 rounded-lg bg-ink text-white hover:opacity-90">결과 전체 다운로드</button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-5 h-fit">
          <div className="text-sm font-semibold text-ink mb-4">설정</div>

          <label className="block mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-ink font-medium">무음 기준 (dB)</span>
              <span className="text-gold font-mono">-{thresholdDb.toFixed(1)}</span>
            </div>
            <input type="range" min={20} max={70} step={0.5} value={thresholdDb}
                   onChange={e => setThresholdDb(+e.target.value)}
                   className="w-full accent-gold" />
            <div className="text-xs text-ink-soft mt-1">기본 TTS: 40 ~ 45dB 권장</div>
          </label>

          <label className="block mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-ink font-medium">최대 무음 시간 (초)</span>
              <span className="text-gold font-mono">{maxSilence.toFixed(2)}</span>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={maxSilence}
                   onChange={e => setMaxSilence(+e.target.value)}
                   className="w-full accent-gold" />
            <div className="text-xs text-ink-soft mt-1">권장: 0.10초</div>
          </label>

          <label className="block mb-5">
            <div className="text-sm text-ink font-medium mb-1">출력 포맷</div>
            <select value={output} onChange={e => setOutput(e.target.value as OutputFormat)}
                    className="w-full border border-borderc-base rounded-xl px-3 py-2 bg-bg-field">
              <option value="mp3">mp3 (192kbps)</option>
              <option value="wav">wav (무손실)</option>
            </select>
            <div className="text-xs text-ink-soft mt-1">mp3: 용량 작음 · wav: 원본 품질</div>
          </label>

          <button
            onClick={processAll}
            disabled={running || items.length === 0}
            className="w-full py-3 rounded-xl bg-gold hover:bg-gold-bright text-white font-semibold disabled:bg-ink-soft disabled:cursor-not-allowed transition"
          >
            {running ? "처리 중..." : `무음 제거 시작 (${items.length}개)`}
          </button>

          <div className="mt-4 text-xs text-ink-soft leading-relaxed bg-bg-tip border border-borderc-base rounded-xl p-3">
            💡 재생 시 뚝뚝 소리가 나면 <b>무음 기준</b>을 40~45dB 사이에서 조금씩 조절해보세요.<br />
            💡 <b>최대 무음 시간</b>은 0.10초(기본값) 근처에서 조절하는 걸 권장합니다.
          </div>
        </div>
      </div>
    </div>
  );
}
