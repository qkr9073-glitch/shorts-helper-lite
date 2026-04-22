import { useCallback, useRef, useState } from "react";
import JSZip from "jszip";
import MobileNotice from "../components/MobileNotice";
import {
  decodeAudio,
  loadWhisper,
  transcribe,
  toPlainText,
  toSRT,
  toVTT,
  MODEL_INFO,
  type Chunk,
  type WhisperModel,
} from "../lib/whisper";

type OutputFormat = "txt" | "srt" | "vtt" | "srt_txt";

type Item = {
  id: string;
  file: File;
  status: "pending" | "decoding" | "transcribing" | "done" | "error";
  progress: number;
  stageLabel?: string;
  duration?: number;
  text?: string;
  chunks?: Chunk[];
  error?: string;
};

const ACCEPT = "audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov,.webm,.mkv,.aac,.ogg";
const MAX_DURATION_SEC = 30 * 60;
const MAX_SIZE_MB = 500;
const EXT_RE = /\.(mp3|wav|m4a|mp4|mov|webm|mkv|aac|ogg|flac)$/i;

const MODEL_SPEED_RATIO: Record<WhisperModel, number> = {
  tiny: 0.15,
  base: 0.25,
  small: 0.6,
  medium: 1.5,
};

function fmtRemain(sec: number) {
  if (sec < 60) return `약 ${Math.max(1, Math.round(sec))}초 남음`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return `약 ${m}분 ${s}초 남음`;
}

function fmtSec(s?: number) {
  if (s == null) return "-";
  const m = Math.floor(s / 60);
  const r = Math.floor(s - m * 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
function fmtSize(n: number) {
  if (n < 1024) return n + "B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + "KB";
  return (n / 1024 / 1024).toFixed(1) + "MB";
}
function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "");
}
function buildOutputs(format: OutputFormat, item: Item): { blob: Blob; name: string }[] {
  const base = baseName(item.file.name);
  const files: { blob: Blob; name: string }[] = [];
  const wantTxt = format === "txt" || format === "srt_txt";
  const wantSrt = format === "srt" || format === "srt_txt";
  const wantVtt = format === "vtt";
  if (wantTxt) {
    const text = item.chunks ? toPlainText(item.chunks) : (item.text || "");
    files.push({ blob: new Blob([text], { type: "text/plain;charset=utf-8" }), name: `${base}.txt` });
  }
  if (wantSrt) {
    files.push({ blob: new Blob([toSRT(item.chunks || [])], { type: "text/plain;charset=utf-8" }), name: `${base}.srt` });
  }
  if (wantVtt) {
    files.push({ blob: new Blob([toVTT(item.chunks || [])], { type: "text/vtt;charset=utf-8" }), name: `${base}.vtt` });
  }
  return files;
}

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/i.test(file.name);
    const el = document.createElement(isVideo ? "video" : "audio") as HTMLMediaElement;
    const url = URL.createObjectURL(file);
    el.preload = "metadata";
    el.src = url;
    el.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(url);
      resolve(el.duration);
    });
    el.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("파일을 읽을 수 없습니다."));
    });
  });
}

export default function Subtitle() {
  const [items, setItems] = useState<Item[]>([]);
  const [model, setModel] = useState<WhisperModel>("small");
  const [language, setLanguage] = useState<string>("korean");
  const [output, setOutput] = useState<OutputFormat>("srt");
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [warn, setWarn] = useState("");
  const [modelLoadProgress, setModelLoadProgress] = useState<{ p: number; file?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setWarn("");
    const rejected: string[] = [];
    const arr: Item[] = [];
    for (const f of Array.from(files)) {
      if (!EXT_RE.test(f.name)) { rejected.push(`${f.name} (지원하지 않는 형식)`); continue; }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) { rejected.push(`${f.name} (${(f.size/1024/1024).toFixed(1)}MB, 최대 ${MAX_SIZE_MB}MB)`); continue; }
      try {
        const dur = await probeDuration(f);
        if (dur > MAX_DURATION_SEC) { rejected.push(`${f.name} (${(dur/60).toFixed(1)}분, 최대 ${MAX_DURATION_SEC/60}분)`); continue; }
        arr.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          status: "pending",
          progress: 0,
          duration: dur,
        });
      } catch {
        rejected.push(`${f.name} (읽기 실패)`);
      }
    }
    if (arr.length) setItems(s => [...s, ...arr]);
    if (rejected.length) setWarn("❌ 추가되지 않음: " + rejected.join(", "));
  }, []);

  function removeItem(id: string) {
    setItems(s => s.filter(x => x.id !== id));
  }
  function clearAll() {
    setItems([]);
  }

  async function processAll() {
    if (running || items.length === 0) return;
    setRunning(true);
    setModelLoadProgress({ p: 0 });
    try {
      const pipe = await loadWhisper(model, (p, file) => {
        setModelLoadProgress({ p, file });
      });
      setModelLoadProgress(null);

      for (const it of items) {
        if (it.status === "done") continue;
        try {
          setItems(s => s.map(x => x.id === it.id ? { ...x, status: "decoding", progress: 0.02, stageLabel: "오디오 디코딩 중", error: undefined } : x));
          const { samples } = await decodeAudio(it.file, p => {
            setItems(s => s.map(x => x.id === it.id ? { ...x, progress: p * 0.2 } : x));
          });

          const expectedSec = Math.max(5, (it.duration || 60) * MODEL_SPEED_RATIO[model]);
          const startT = Date.now();
          setItems(s => s.map(x => x.id === it.id ? { ...x, status: "transcribing", progress: 0.25, stageLabel: `음성 인식 중 (${fmtRemain(expectedSec)})` } : x));
          const ticker = setInterval(() => {
            const elapsed = (Date.now() - startT) / 1000;
            const frac = Math.min(0.95, 0.25 + (elapsed / expectedSec) * 0.7);
            const remain = Math.max(0, expectedSec - elapsed);
            setItems(s => s.map(x => x.id === it.id && x.status === "transcribing" ? { ...x, progress: frac, stageLabel: `음성 인식 중 (${fmtRemain(remain)})` } : x));
          }, 500);

          let result;
          try {
            result = await transcribe(pipe, samples, language);
          } finally {
            clearInterval(ticker);
          }

          setItems(s => s.map(x => x.id === it.id ? {
            ...x,
            status: "done",
            progress: 1,
            text: result.text,
            chunks: result.chunks,
            stageLabel: "완료",
          } : x));
        } catch (e) {
          setItems(s => s.map(x => x.id === it.id ? { ...x, status: "error", error: (e as Error).message } : x));
        }
      }
    } catch (e) {
      setWarn("❌ 모델 로딩 실패: " + (e as Error).message + " (WebGPU 미지원 브라우저일 수 있어요. Chrome/Edge 최신 버전 권장)");
    } finally {
      setModelLoadProgress(null);
      setRunning(false);
    }
  }

  function downloadOne(it: Item) {
    if (!it.chunks) return;
    const files = buildOutputs(output, it);
    for (const { blob, name } of files) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async function downloadAllZip() {
    const done = items.filter(i => i.chunks);
    if (done.length === 0) return;
    const zip = new JSZip();
    for (const it of done) {
      for (const { blob, name } of buildOutputs(output, it)) {
        zip.file(name, blob);
      }
    }
    const out = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(out);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles-${output}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <MobileNotice tool="대본 추출" />
      <div className="flex items-center gap-3 mb-1">
        <span className="text-3xl">📝</span>
        <h1 className="text-2xl font-bold text-ink">자막 추출기</h1>
      </div>
      <p className="text-ink-muted mb-3 text-[14.5px] sm:text-base">
        영상·오디오 파일에서 자막(SRT/VTT/TXT)을 자동 추출합니다. OpenAI Whisper 모델이 <b>내 브라우저 안에서 직접</b> 실행돼요 — 파일은 서버로 올라가지 않아요.
      </p>
      <div className="mb-6 text-xs bg-bg-tip border border-borderc-base text-gold-tip rounded-xl px-3 py-2 inline-block">
        ⚠️ 파일당 최대 <b>{MAX_DURATION_SEC/60}분</b> · <b>{MAX_SIZE_MB}MB</b> · 모델은 첫 1회만 다운로드 후 캐시됩니다.
      </div>
      {warn && <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{warn}</div>}

      {modelLoadProgress && (
        <div className="mb-4 bg-white rounded-2xl shadow-card p-4">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="font-semibold text-ink">📥 Whisper 모델 다운로드 중...</span>
            <span className="text-gold font-bold">{Math.round(modelLoadProgress.p * 100)}%</span>
          </div>
          <div className="h-2.5 bg-bg-statusbar rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gold to-gold-bright transition-all"
                 style={{ width: `${Math.round(modelLoadProgress.p * 100)}%` }} />
          </div>
          <div className="text-[11px] text-ink-soft mt-1.5 truncate">
            {modelLoadProgress.file || "초기화 중..."}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">
            💡 한 번만 받으면 다음부터는 즉시 시작해요.
          </div>
        </div>
      )}

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
            <div className="text-4xl mb-2">🎬</div>
            <div className="text-sm text-ink-muted">클릭하거나 파일을 끌어다 놓으세요</div>
            <div className="text-xs text-ink-soft mt-1">영상 / 오디오 (mp4, mov, webm, mp3, wav, m4a 등)</div>
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
                    <div className="text-xs text-ink-soft">
                      {fmtSize(it.file.size)} · {fmtSec(it.duration)} · {
                        it.status === "done" ? <span className="text-green-600 font-medium">추출 완료</span>
                        : it.status === "error" ? <span className="text-red-500">{it.error}</span>
                        : it.status === "pending" ? "대기"
                        : it.stageLabel
                      }
                    </div>
                  </div>
                  {it.status === "done" && (
                    <button onClick={() => downloadOne(it)} className="text-xs bg-gold text-white px-2.5 py-1.5 rounded-lg hover:bg-gold-bright font-semibold" title="다운로드">⬇ {output === "srt_txt" ? "SRT+TXT" : output.toUpperCase()}</button>
                  )}
                  <button onClick={() => removeItem(it.id)} className="text-ink-soft hover:text-red-500 text-sm px-2" title="삭제">✕</button>
                </div>
                {(it.status === "decoding" || it.status === "transcribing") && (
                  <div className="mt-2">
                    <div className="flex justify-between items-center text-[11px] text-ink-muted mb-1">
                      <span>{it.stageLabel}...</span>
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
                {it.status === "done" && it.text && (
                  <details className="mt-2">
                    <summary className="text-xs text-gold cursor-pointer hover:text-gold-bright">미리보기</summary>
                    <div className="mt-1.5 text-xs text-ink-muted bg-bg-base rounded-lg p-2 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {it.text.slice(0, 500)}{it.text.length > 500 ? "..." : ""}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="mt-3 flex gap-2">
              <button onClick={clearAll} className="text-xs px-3 py-1.5 rounded-lg border border-borderc-base text-ink-muted hover:bg-bg-base">전체 비우기</button>
              {items.some(i => i.chunks) && (
                <button onClick={downloadAllZip} className="text-xs px-3 py-1.5 rounded-lg bg-ink text-white hover:opacity-90">결과 전체 ZIP 다운로드</button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-5 h-fit">
          <div className="text-sm font-semibold text-ink mb-4">설정</div>

          <label className="block mb-4">
            <div className="text-sm text-ink font-medium mb-1">모델 (정확도 ↔ 속도)</div>
            <select value={model} onChange={e => setModel(e.target.value as WhisperModel)}
                    className="w-full border border-borderc-base rounded-xl px-3 py-2 bg-bg-field" disabled={running}>
              {Object.entries(MODEL_INFO).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <div className="text-xs text-ink-soft mt-1">{MODEL_INFO[model].desc}</div>
          </label>

          <label className="block mb-4">
            <div className="text-sm text-ink font-medium mb-1">언어</div>
            <select value={language} onChange={e => setLanguage(e.target.value)}
                    className="w-full border border-borderc-base rounded-xl px-3 py-2 bg-bg-field" disabled={running}>
              <option value="korean">한국어</option>
              <option value="english">영어</option>
              <option value="chinese">중국어</option>
              <option value="japanese">일본어</option>
            </select>
            <div className="text-xs text-ink-soft mt-1">영상의 주 언어를 선택하세요</div>
          </label>

          <label className="block mb-5">
            <div className="text-sm text-ink font-medium mb-1">출력 포맷</div>
            <select value={output} onChange={e => setOutput(e.target.value as OutputFormat)}
                    className="w-full border border-borderc-base rounded-xl px-3 py-2 bg-bg-field">
              <option value="srt_txt">SRT + TXT (둘 다) ⭐</option>
              <option value="srt">SRT (타임코드 포함, 영상편집용)</option>
              <option value="txt">TXT (텍스트만)</option>
              <option value="vtt">VTT (웹 플레이어용)</option>
            </select>
          </label>

          <button
            onClick={processAll}
            disabled={running || items.length === 0}
            className="w-full py-3 rounded-xl bg-gold hover:bg-gold-bright text-white font-semibold disabled:bg-ink-soft disabled:cursor-not-allowed transition"
          >
            {running ? "처리 중..." : `자막 추출 시작 (${items.length}개)`}
          </button>

          <div className="mt-4 text-xs text-ink-muted leading-relaxed bg-bg-tip border border-borderc-base rounded-xl p-3">
            <div className="font-semibold text-ink mb-1.5">🎯 모델 선택 가이드</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 mb-2">
              <span className="font-semibold text-gold-tip">tiny</span>
              <span>영어 간단한 영상 · 테스트용 (한국어/중국어엔 약함)</span>
              <span className="font-semibold text-gold-tip">base</span>
              <span>영어 일반 영상 · 한/중/일은 정확도 아쉬움</span>
              <span className="font-semibold text-gold-tip">small ⭐</span>
              <span><b>기본 추천</b> · 한/중/일 대부분 영상 OK</span>
              <span className="font-semibold text-gold-tip">medium</span>
              <span>한국어 정확도 높이고 싶을 때 · 방언/사투리/빠른 말투 · <b>중국어 더우인/샤오홍슈 정확도 최고</b></span>
            </div>
            <div className="border-t border-borderc-base/60 pt-1.5 mt-1.5">
              💡 첫 실행 시 모델 다운로드 1~5분 (크기별 · 이후 캐시돼서 바로 시작)<br />
              💡 <b>Chrome · Edge</b> 최신 버전 권장 (WebGPU 가속)<br />
              💡 언어 선택은 꼭 <b>영상 실제 언어</b>로! (중국어 영상에 한국어 선택하면 엉뚱한 결과)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
