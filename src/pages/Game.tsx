import { useEffect, useRef, useState } from "react";

const CANVAS_W = 1040;
const CANVAS_H = 500;
const GROUND_Y = CANVAS_H - 80;
const GRAVITY = 0.7;
const JUMP_V = -15;
const KANG_X = 100;
const KANG_W = 88;
const KANG_H = 88;
const VIEW_UNIT = 250;

const PHOTOS = [
  "/game/jun1.jpg",
  "/game/jun2.jpg",
  "/game/jun3.jpg",
  "/game/jun4.jpg",
  "/game/jun5.jpg",
  "/game/jun6.jpg",
  "/game/jun7.jpg",
];

const QUOTES = [
  "1일 1업로드 하셨나요? 🔥",
  "꾸준휘 해야지요 ✊",
  "지치면 쇼츠보고 다시 쇼츠 만드세요!",
  "준휘쌤은 여러분을 믿습니다",
  "꾸준휘! 수창을 위하여!",
  "오늘의 업로드는?",
  "알고리즘은 꾸준한 자의 편",
  "어제보다 0.1편 더!",
  "쇼츠는 거짓말 안해요",
  "3분만 더 편집합시다",
  "준휘쌤 번호는 010-9... 이게 왜 궁금합니까!!!",
  "달을 향해 쏴라! 실패해도 별이 될테니!",
  "준휘쌤도 포기 안했는데, 왜 포기하나요!",
  "준휘쌤의 MBTI는 love 입니다",
  "준휘쌤은 소개팅 받지 않습니다",
  "준휘쌤은 테토남입니다",
  "준휘쌤은 편식을 안합니다",
  "준휘쌤은 술 좋아합니다",
  "준휘쌤은 회를 좋아해요",
  "준휘쌤은 양념치킨파입니다",
  "준휘쌤은 치즈보다 참치김밥이 좋아요",
  "완벽한 쇼츠? 그런 건 없어요",
  "일단 업로드! 피드백은 그 다음",
  "잘 만들기보다 자주 만들기",
  "편집 피곤하죠? 구독자는 기다려요",
  "조회수 1만부터 시작이에요",
  "썸네일 색 한 번 바꿔보셨어요?",
  "훅 3초가 인생을 바꿉니다",
  "오늘 안 올리면 내일은 두 배",
  "루틴 만드는 게 실력이에요",
  "완성된 80점이 미완성 90점보다 나아요",
  "제목에 숫자 하나 더 넣어보세요",
  "구독자는 꾸준한 업로더를 좋아해요",
  "쇼츠는 속도전입니다",
  "매일 한 편, 그게 꾸준휘죠",
  "망한 영상은 다음 영상의 스승",
  "편집 더 할 시간에 새 영상 찍어요",
  "알고리즘은 포기를 싫어해요",
  "1년 하면 실력, 3년 하면 수익",
  "장비 탓 금지! 꾸준함이 장비예요",
  "한 편 더 찍고 잡시다",
  "꾸준휘 하면 수창 옵니다!",
];

const DEATH_QUOTES = [
  "쇼츠 알고리즘에 묻혔습니다 💀",
  "꾸준휘가 부족했네요",
  "준휘쌤이 실망했어요...",
  "나보다 더 쇼츠해보세요",
  "다시! 꾸준휘 파이팅!",
  "알고리즘 신의 저주...",
];

type Obstacle = { x: number; kind: "cactus" | "block"; w: number; h: number; passed: boolean };
type Heckle = { x: number; y: number; photoIdx: number; quote: string; vx: number; size: number };
type Difficulty = "easy" | "normal" | "hard";

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; desc: string; startSpeed: number; scale: number; spawnBase: number }> = {
  easy:   { label: "하",  desc: "느림 · 처음 플레이", startSpeed: 3.5, scale: 0.010, spawnBase: 170 },
  normal: { label: "중 ⭐", desc: "기본 난이도",         startSpeed: 5.0, scale: 0.015, spawnBase: 140 },
  hard:   { label: "상",  desc: "빠름 · 고수용",       startSpeed: 7.0, scale: 0.025, spawnBase: 110 },
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [deathQuote, setDeathQuote] = useState("");
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem("kangaroo_jump_high") || "0"));
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const saved = localStorage.getItem("kangaroo_jump_diff") as Difficulty | null;
    return saved && saved in DIFFICULTY_CONFIG ? saved : "normal";
  });
  const [muted, setMuted] = useState(() => localStorage.getItem("kangaroo_jump_mute") === "1");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioAvailable, setAudioAvailable] = useState(false);

  const stateRef = useRef({
    y: GROUND_Y - KANG_H,
    vy: 0,
    jumping: false,
    obstacles: [] as Obstacle[],
    heckles: [] as Heckle[],
    quoteQueue: [] as string[],
    groundOffset: 0,
    frame: 0,
    nextSpawn: 70,
    nextHeckle: 180,
    speed: 5,
    sunY: CANVAS_H + 80,
    sunPhotoIdx: 0,
    score: 0,
    running: false,
  });

  const imgsRef = useRef<{ photos: HTMLImageElement[]; loaded: boolean[] }>({
    photos: [],
    loaded: PHOTOS.map(() => false),
  });

  useEffect(() => {
    const candidates = ["/game/bgm.wav", "/game/bgm.mp3", "/game/bgm.ogg"];
    let idx = 0;
    const a = new Audio();
    a.loop = true;
    a.volume = 0.4;
    a.preload = "auto";
    a.oncanplay = () => setAudioAvailable(true);
    a.onerror = () => {
      idx++;
      if (idx < candidates.length) {
        a.src = candidates[idx];
        a.load();
      } else {
        setAudioAvailable(false);
        console.warn("BGM 파일 없음: public/game/bgm.wav 또는 bgm.mp3 넣으면 자동 재생됩니다");
      }
    };
    a.src = candidates[0];
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    imgsRef.current.photos = PHOTOS.map((src, i) => {
      const img = new Image();
      img.onload = () => {
        imgsRef.current.loaded[i] = true;
        console.log(`✅ 사진 로드됨: ${src} (${img.naturalWidth}x${img.naturalHeight})`);
      };
      img.onerror = () => {
        console.error(`❌ 사진 로드 실패: ${src} — public/game/ 폴더 확인하세요`);
      };
      img.src = src;
      return img;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;

    const jump = () => {
      const s = stateRef.current;
      if (!s.running || s.jumping) return;
      s.vy = JUMP_V;
      s.jumping = true;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    const onTap = (e: Event) => { e.preventDefault(); jump(); };
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onTap);

    const loop = () => {
      const s = stateRef.current;

      if (s.running) {
        s.frame++;
        s.score = Math.floor(s.frame / 6);

        s.vy += GRAVITY;
        s.y += s.vy;
        if (s.y >= GROUND_Y - KANG_H) {
          s.y = GROUND_Y - KANG_H;
          s.vy = 0;
          s.jumping = false;
        }

        s.groundOffset = (s.groundOffset + s.speed) % 40;
        if (s.sunY > CANVAS_H * 0.22) s.sunY -= 0.35;

        s.nextSpawn--;
        if (s.nextSpawn <= 0) {
          const isCactus = Math.random() < 0.6;
          const w = isCactus ? 38 : 52;
          const h = isCactus ? 78 : 48;
          s.obstacles.push({
            x: CANVAS_W + 50,
            kind: isCactus ? "cactus" : "block",
            w,
            h,
            passed: false,
          });
          const cfg = DIFFICULTY_CONFIG[difficulty];
          const base = Math.max(cfg.spawnBase - 80, cfg.spawnBase - s.score * 0.3);
          s.nextSpawn = base + Math.random() * 80;
        }

        for (const o of s.obstacles) {
          o.x -= s.speed;
          const ox = o.x + 8, oy = GROUND_Y - o.h + 6, ow = o.w - 16, oh = o.h - 10;
          const kx = KANG_X + 22, ky = s.y + 28, kw = KANG_W - 44, kh = KANG_H - 38;
          if (kx < ox + ow && kx + kw > ox && ky < oy + oh && ky + kh > oy) {
            s.running = false;
            setGameOver(true);
            setDeathQuote(DEATH_QUOTES[Math.floor(Math.random() * DEATH_QUOTES.length)]);
            const prev = Number(localStorage.getItem("kangaroo_jump_high") || "0");
            if (s.score > prev) {
              localStorage.setItem("kangaroo_jump_high", String(s.score));
              setHighScore(s.score);
            }
          }
        }
        s.obstacles = s.obstacles.filter(o => o.x > -100);

        s.nextHeckle--;
        if (s.nextHeckle <= 0) {
          const loadedIdx = imgsRef.current.loaded
            .map((l, i) => (l ? i : -1))
            .filter(i => i >= 0);
          if (loadedIdx.length > 0) {
            const pick = loadedIdx[Math.floor(Math.random() * loadedIdx.length)];
            if (s.quoteQueue.length === 0) s.quoteQueue = shuffle(QUOTES);
            const nextQuote = s.quoteQueue.pop()!;
            s.heckles.push({
              x: CANVAS_W + 100,
              y: 40 + Math.random() * 120,
              photoIdx: pick,
              quote: nextQuote,
              vx: 1.5 + Math.random() * 0.8,
              size: 80 + Math.random() * 20,
            });
          }
          s.nextHeckle = 280 + Math.random() * 200;
        }
        for (const h of s.heckles) h.x -= h.vx;
        s.heckles = s.heckles.filter(h => h.x > -300);
        const cfgSpeed = DIFFICULTY_CONFIG[difficulty];
        s.speed = cfgSpeed.startSpeed + s.score * cfgSpeed.scale;
        setScore(s.score);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      sky.addColorStop(0, "#ffd89b");
      sky.addColorStop(0.55, "#ffb38a");
      sky.addColorStop(1, "#fff3e0");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const sunImg = imgsRef.current.photos[s.sunPhotoIdx];
      const sunCx = CANVAS_W - 140;
      const sunCy = s.sunY;
      const sunR = 80;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2 + s.frame * 0.004;
        ctx.beginPath();
        ctx.moveTo(sunCx + Math.cos(ang) * (sunR + 8), sunCy + Math.sin(ang) * (sunR + 8));
        ctx.lineTo(sunCx + Math.cos(ang) * (sunR + 55), sunCy + Math.sin(ang) * (sunR + 55));
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(255, 210, 120, 0.35)";
        ctx.stroke();
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(sunCx, sunCy, sunR, 0, Math.PI * 2);
      ctx.clip();
      if (sunImg && imgsRef.current.loaded[s.sunPhotoIdx]) {
        const iw = sunImg.width, ih = sunImg.height;
        const side = Math.min(iw, ih);
        const sx = (iw - side) / 2;
        const sy = 0;
        ctx.drawImage(sunImg, sx, sy, side, side, sunCx - sunR, sunCy - sunR, sunR * 2, sunR * 2);
      } else {
        ctx.fillStyle = "#ffcc66";
        ctx.fillRect(sunCx - sunR, sunCy - sunR, sunR * 2, sunR * 2);
        ctx.fillStyle = "#8a6500";
        ctx.font = "bold 16px Pretendard, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("준휘쌤", sunCx, sunCy + 6);
        ctx.textAlign = "left";
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(sunCx, sunCy, sunR, 0, Math.PI * 2);
      ctx.strokeStyle = "#e8a928";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#c8860a";
      ctx.fillRect(0, GROUND_Y, CANVAS_W, 3);
      ctx.fillStyle = "#8a6500";
      for (let x = -s.groundOffset; x < CANVAS_W; x += 40) {
        ctx.fillRect(x, GROUND_Y + 7, 18, 2);
      }

      for (const o of s.obstacles) {
        const oy = GROUND_Y - o.h;
        if (o.kind === "cactus") {
          ctx.fillStyle = "#2d7a4a";
          drawRoundRect(ctx, o.x + 10, oy, o.w - 20, o.h, 6);
          ctx.fill();
          drawRoundRect(ctx, o.x, oy + 18, 14, 28, 4);
          ctx.fill();
          drawRoundRect(ctx, o.x + o.w - 14, oy + 12, 14, 22, 4);
          ctx.fill();
          ctx.strokeStyle = "#1d5433";
          ctx.lineWidth = 2;
          for (let ly = oy + 10; ly < oy + o.h - 6; ly += 12) {
            ctx.beginPath();
            ctx.moveTo(o.x + 14, ly);
            ctx.lineTo(o.x + o.w - 14, ly);
            ctx.stroke();
          }
        } else {
          drawRoundRect(ctx, o.x, oy, o.w, o.h, 8);
          ctx.fillStyle = "#c8860a";
          ctx.fill();
          ctx.strokeStyle = "#8a6500";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 28px Pretendard, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("!", o.x + o.w / 2, oy + o.h / 2);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }
      }

      for (const h of s.heckles) {
        const img = imgsRef.current.photos[h.photoIdx];
        const loaded = imgsRef.current.loaded[h.photoIdx];
        const sz = h.size;
        const photoLeft = h.x - sz / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(h.x, h.y + sz / 2, sz / 2, 0, Math.PI * 2);
        ctx.clip();
        if (img && loaded) {
          const iw = img.width, ih = img.height;
          const side = Math.min(iw, ih);
          const sx = (iw - side) / 2;
          const sy = 0;
          ctx.drawImage(img, sx, sy, side, side, photoLeft, h.y, sz, sz);
        } else {
          ctx.fillStyle = "#1f2540";
          ctx.fillRect(photoLeft, h.y, sz, sz);
        }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(h.x, h.y + sz / 2, sz / 2, 0, Math.PI * 2);
        ctx.strokeStyle = "#c8860a";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = "bold 14px Pretendard, sans-serif";
        const tw = ctx.measureText(h.quote).width;
        const bw = tw + 20;
        const bx = photoLeft - bw - 12;
        const by = h.y + sz / 2 - 15;
        drawRoundRect(ctx, bx, by, bw, 30, 12);
        ctx.fillStyle = "rgba(255,255,255,0.97)";
        ctx.strokeStyle = "#c8860a";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + bw, by + 12);
        ctx.lineTo(photoLeft - 2, by + 15);
        ctx.lineTo(bx + bw, by + 20);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.97)";
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#1f2540";
        ctx.textAlign = "center";
        ctx.fillText(h.quote, bx + bw / 2, by + 20);
        ctx.textAlign = "left";
      }

      const hitCx = KANG_X + KANG_W / 2;
      const hitCy = s.y + KANG_H * 0.55;
      const hitR = 26;
      const glow = ctx.createRadialGradient(hitCx, hitCy, 4, hitCx, hitCy, hitR + 8);
      glow.addColorStop(0, "rgba(255, 220, 100, 0.55)");
      glow.addColorStop(0.7, "rgba(255, 200, 80, 0.25)");
      glow.addColorStop(1, "rgba(255, 200, 80, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(hitCx, hitCy, hitR + 8, 0, Math.PI * 2);
      ctx.fill();

      if (!s.jumping) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#1f2540";
        ctx.beginPath();
        ctx.ellipse(hitCx, GROUND_Y + 2, 28, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.font = `${KANG_H}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 4;
      ctx.fillText("🦘", KANG_X, s.y);
      ctx.restore();

      ctx.fillStyle = "rgba(31,37,64,0.88)";
      ctx.font = "bold 26px Pretendard, sans-serif";
      ctx.fillText(`조회수 ${(s.score * VIEW_UNIT).toLocaleString()}`, 24, 38);
      ctx.font = "14px Pretendard, sans-serif";
      ctx.fillText(`최고 ${(highScore * VIEW_UNIT).toLocaleString()}`, 24, 62);

      rafId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onTap);
    };
  }, [highScore, difficulty]);

  function start() {
    const s = stateRef.current;
    s.y = GROUND_Y - KANG_H;
    s.vy = 0;
    s.jumping = false;
    s.obstacles = [];
    s.heckles = [];
    s.quoteQueue = shuffle(QUOTES);
    s.groundOffset = 0;
    s.frame = 0;
    s.nextSpawn = 70;
    s.nextHeckle = 180;
    s.speed = DIFFICULTY_CONFIG[difficulty].startSpeed;
    s.sunY = CANVAS_H + 80;
    const loadedIdx = imgsRef.current.loaded
      .map((l, i) => (l ? i : -1))
      .filter(i => i >= 0);
    s.sunPhotoIdx = loadedIdx.length > 0
      ? loadedIdx[Math.floor(Math.random() * loadedIdx.length)]
      : 0;
    s.score = 0;
    s.running = true;
    setScore(0);
    setStarted(true);
    setGameOver(false);
    if (audioRef.current && audioAvailable) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }

  function toggleMute() {
    setMuted(m => {
      const next = !m;
      localStorage.setItem("kangaroo_jump_mute", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-3xl">🦘</span>
        <h1 className="text-2xl font-bold text-ink">캥거루 점프!</h1>
        <span className="text-xs bg-bg-tip border border-borderc-base text-gold-tip rounded-full px-2.5 py-0.5 font-semibold">꾸준휘 트레이닝</span>
      </div>
      <p className="text-ink-muted mb-6">
        <b>Space</b> 또는 화면을 <b>탭/클릭</b>해서 점프. 준휘쌤 잔소리를 피하세요 ㅋㅋ
      </p>

      <div className="relative inline-block bg-white rounded-2xl shadow-card p-3 max-w-full">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block rounded-xl cursor-pointer"
          style={{ maxWidth: "100%", height: "auto" }}
        />
        {audioAvailable && (
          <button
            onClick={toggleMute}
            title={muted ? "음소거 해제" : "음소거"}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-card flex items-center justify-center text-lg transition z-10"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/60 rounded-2xl backdrop-blur-sm">
            <div className="text-5xl mb-3 animate-bounce">🦘</div>
            <div className="text-white text-2xl font-bold mb-1.5">캥거루 점프</div>
            <div className="text-white/90 text-sm mb-4 text-center max-w-xs leading-relaxed">
              준휘쌤의 잔소리가<br />당신을 향해 날아옵니다...<br />
              <span className="text-gold-bright font-semibold">피하세요!</span>
            </div>
            <div className="mb-5">
              <div className="text-white/80 text-xs font-semibold mb-2 text-center">난이도 선택</div>
              <div className="flex gap-2">
                {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(d => (
                  <button key={d}
                          onClick={() => { setDifficulty(d); localStorage.setItem("kangaroo_jump_diff", d); }}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition ${difficulty === d ? "bg-gold text-white shadow-lg" : "bg-white/20 text-white hover:bg-white/30"}`}>
                    {DIFFICULTY_CONFIG[d].label}
                  </button>
                ))}
              </div>
              <div className="text-white/70 text-[11px] mt-1.5 text-center">{DIFFICULTY_CONFIG[difficulty].desc}</div>
            </div>
            <button onClick={start}
                    className="px-8 py-3 rounded-xl bg-gold hover:bg-gold-bright text-white font-bold shadow-lg transition hover:-translate-y-0.5">
              🚀 시작하기
            </button>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/70 rounded-2xl backdrop-blur-sm">
            <div className="text-5xl mb-2">💀</div>
            <div className="text-white text-2xl font-bold mb-1">게임오버</div>
            <div className="text-gold-bright text-base font-semibold mb-3 max-w-xs text-center">"{deathQuote}"</div>
            <div className="text-white/90 text-sm mb-3">
              조회수 <b className="text-gold-bright text-lg">{(score * VIEW_UNIT).toLocaleString()}</b> · 최고 {(highScore * VIEW_UNIT).toLocaleString()}
              {score >= highScore && score > 0 && <span className="ml-2 text-gold-bright font-bold">🏆 신기록!</span>}
            </div>
            <div className="flex gap-2 mb-3">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(d => (
                <button key={d}
                        onClick={() => { setDifficulty(d); localStorage.setItem("kangaroo_jump_diff", d); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${difficulty === d ? "bg-gold text-white" : "bg-white/20 text-white hover:bg-white/30"}`}>
                  {DIFFICULTY_CONFIG[d].label}
                </button>
              ))}
            </div>
            <button onClick={start}
                    className="px-8 py-3 rounded-xl bg-gold hover:bg-gold-bright text-white font-bold shadow-lg transition hover:-translate-y-0.5">
              🔄 다시 도전
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-ink-muted leading-relaxed bg-bg-tip border border-borderc-base rounded-xl p-3 max-w-xl">
        💡 점수는 내 브라우저에만 저장돼요 (localStorage).<br />
        💡 <b>모바일:</b> 화면 탭 · <b>데스크톱:</b> Space / ↑ / 클릭으로 점프<br />
        💡 점수 올라갈수록 속도가 점점 빨라져요. 꾸준휘 정신으로 버티세요!
      </div>
    </div>
  );
}
