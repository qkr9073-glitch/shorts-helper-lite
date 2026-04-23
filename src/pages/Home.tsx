import { Link } from "react-router-dom";

type Tool = {
  to: string;
  emoji: string;
  title: string;
  desc: string;
  badge?: string;
  pcOnly?: boolean;
  cta: string;
};

const TOOLS: Tool[] = [
  {
    to: "/silence",
    emoji: "🔇",
    title: "무음 제거기",
    desc: "영상 속 조용한 구간을 자동으로 잘라내 편집 시간을 단축해드려요. dB 기준도 조절 가능.",
    pcOnly: true,
    cta: "무음 제거 시작",
  },
  {
    to: "/subtitle",
    emoji: "📝",
    title: "영상 대본 추출",
    desc: "Whisper AI로 영상에서 대사를 텍스트/자막 파일(.txt/.srt/.vtt)로 뽑아드려요.",
    badge: "AI",
    pcOnly: true,
    cta: "대본 추출 시작",
  },
  {
    to: "/game",
    emoji: "🦘",
    title: "캥거루 점프",
    desc: "쉬어가는 시간용 미니 게임. 준휘쌤 이미지를 모으고 최고 기록에 도전하세요.",
    badge: "모바일 OK",
    cta: "게임 시작",
  },
];

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="text-center mb-8 sm:mb-12">
        <div className="inline-block px-3 py-1 rounded-full bg-gold/10 text-gold-tip text-[11px] font-semibold mb-4 tracking-wide">
          💛 핸드인캥거루 무료 라이트 버전
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold text-ink leading-tight">
          쇼츠 제작 도우미
        </h1>
        <p className="mt-4 text-[15px] sm:text-base text-ink-muted max-w-lg mx-auto">
          쇼츠 편집에 꼭 필요한 도구들을 무료로 제공합니다.
          <br />
          로그인 없이 브라우저에서 바로 사용하세요.
        </p>
      </div>

      <a
        href="https://open.kakao.com/o/gH4HL25h"
        target="_blank"
        rel="noreferrer"
        className="relative block group mb-8 sm:mb-10 rounded-3xl overflow-hidden"
      >
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 blur-lg opacity-60 group-hover:opacity-90 animate-pulse" />
        <div className="relative rounded-3xl bg-gradient-to-br from-[#FEE500] via-[#FFD900] to-[#FEE500] p-5 sm:p-6 shadow-[0_12px_40px_rgba(254,229,0,0.5)] ring-2 ring-yellow-400 group-hover:scale-[1.01] transition-transform">
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold tracking-wider animate-bounce shadow-md">
            🔥 HOT
          </div>
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#3C1E1E] flex items-center justify-center text-3xl sm:text-4xl shadow-inner">
              💬
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[11px] sm:text-xs font-bold text-[#3C1E1E]/70 mb-0.5 tracking-wide">
                👋 쇼츠 크리에이터라면 필수!
              </div>
              <div className="text-base sm:text-xl font-extrabold text-[#3C1E1E] leading-tight">
                박준휘 쇼츠 커뮤니티 오픈채팅
              </div>
              <div className="text-[12px] sm:text-[13px] text-[#3C1E1E]/80 mt-1 leading-snug">
                실시간 꿀팁 · 트렌드 공유 · 질문 답변 · 함께 성장하는 동료들
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#3C1E1E] text-[#FEE500] text-xs sm:text-sm font-bold whitespace-nowrap group-hover:bg-black transition shadow-md">
                무료 입장 →
              </div>
            </div>
          </div>
        </div>
      </a>

      <div className="sm:hidden mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-2.5">
          <span className="text-xl leading-none">💻</span>
          <div className="flex-1">
            <div className="text-sm font-bold text-amber-900 mb-1">
              지금 모바일로 접속 중이시네요
            </div>
            <p className="text-[12.5px] text-amber-800 leading-relaxed">
              <b>무음 제거기 · 대본 추출기</b>는 영상을 브라우저에서 직접 처리해서 모바일은 무거워요.
              편집용 도구는 <b>PC(크롬)로 접속</b>을 권장드려요. 게임은 모바일에서도 쌩쌩합니다 🦘
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {TOOLS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group card hover:border-gold hover:shadow-[0_8px_32px_rgba(200,134,10,0.15)] transition-all flex flex-col"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-4xl">{t.emoji}</div>
              <div className="flex flex-col items-end gap-1">
                {t.badge && (
                  <span className="px-2.5 py-1 rounded-full bg-gold/10 text-gold-tip text-[10px] font-bold tracking-wide">
                    {t.badge}
                  </span>
                )}
                {t.pcOnly && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold tracking-wide border border-amber-300">
                    💻 PC 권장
                  </span>
                )}
              </div>
            </div>
            <h2 className="text-xl font-bold text-ink mb-2 group-hover:text-gold transition">
              {t.title}
            </h2>
            <p className="text-[13.5px] text-ink-muted leading-relaxed flex-1 mb-4">
              {t.desc}
            </p>
            <div className="inline-flex items-center gap-1.5 text-gold font-semibold text-sm group-hover:gap-2.5 transition-all">
              {t.cta}
              <span aria-hidden>→</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 p-5 rounded-2xl bg-bg-tip border border-gold/30">
        <div className="text-[11px] font-bold text-gold-tip mb-1.5 tracking-wide">
          💡 이런 분께 추천해요
        </div>
        <ul className="text-[13.5px] text-ink-muted space-y-1">
          <li>• 쇼츠 영상 편집할 때 무음 구간 일일이 자르기 번거로운 분</li>
          <li>• 해외 영상의 대사를 빠르게 텍스트로 뽑고 싶은 분</li>
          <li>• 가끔 쉴 때 할 게임이 필요한 분 🦘</li>
        </ul>
      </div>
    </div>
  );
}
