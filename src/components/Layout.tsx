import { Link, Outlet } from "react-router-dom";

const CAFE_URL = "https://cafe.naver.com/kangarooshorts";
const YT_URL = "https://www.youtube.com/@준휘야쇼츠하자";

export default function Layout() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-borderc-base">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg" />
            <div>
              <div className="text-[15px] font-bold text-ink group-hover:text-gold transition">
                쇼츠 제작 도우미
              </div>
              <div className="text-[10px] text-ink-soft -mt-0.5">
                by 핸드인캥거루 · 무료 라이트 버전
              </div>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 relative">
        <img
          src="/logo.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none fixed bottom-0 right-0 w-[60vw] max-w-[520px] opacity-[0.05] z-0"
        />
        <div className="relative z-10">
          <Outlet />
        </div>
        <a
          href="https://open.kakao.com/o/gH4HL25h"
          target="_blank"
          rel="noreferrer"
          aria-label="박준휘 쇼츠 커뮤니티 오픈채팅 입장"
          className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-[#FEE500] hover:bg-[#FFD900] text-[#3C1E1E] font-bold text-sm shadow-[0_10px_30px_rgba(254,229,0,0.6)] ring-2 ring-yellow-400/70 hover:-translate-y-0.5 transition"
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#3C1E1E] text-[#FEE500] text-base">
            💬
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-[#FEE500] animate-pulse" />
          </span>
          <span className="leading-tight">
            <span className="block text-[10px] font-bold opacity-80">박준휘 쇼츠 커뮤니티</span>
            <span className="block">오픈채팅 입장 →</span>
          </span>
        </a>
      </main>

      <footer className="mt-12 border-t border-borderc-base bg-white/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <a
              href={CAFE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#03C75A] hover:bg-[#02b352] text-white text-sm font-semibold transition shadow-sm"
            >
              <span className="text-lg leading-none">📗</span>
              <span>꾸준휘 쇼츠 수익화 카페</span>
            </a>
            <a
              href={YT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FF0000] hover:bg-[#dd0000] text-white text-sm font-semibold transition shadow-sm"
            >
              <span className="text-lg leading-none">▶️</span>
              <span>쇼츠 수익화 공부는 여기</span>
            </a>
            <a
              href="https://www.instagram.com/p/DXd3QbwEz74/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] hover:opacity-90 text-white text-sm font-semibold transition shadow-sm"
            >
              <span className="text-lg leading-none">💛</span>
              <span>박준휘 소개 영상</span>
            </a>
          </div>

          <div className="p-4 rounded-2xl bg-bg-base border border-borderc-base text-[12px] text-ink-muted leading-relaxed">
            <div className="font-semibold text-ink mb-1">⚠️ 저작권 및 이용 안내</div>
            <p className="mb-1">
              © 주식회사 핸드인캥거루. 본 사이트 및 모든 콘텐츠의 저작권은
              주식회사 핸드인캥거루에 있습니다.
            </p>
            <p>
              <b className="text-ink">무단 복제 · 변환 · 배포 · 상업적 이용을 금지</b>
              하며, 위반 시 관련 법령에 따라 법적 책임이 따를 수 있습니다.
              업로드한 영상/음성 파일은 서버에 저장되지 않고 본인의 브라우저에서만 처리됩니다.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
