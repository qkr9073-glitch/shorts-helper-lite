type Props = {
  tool: "무음 제거" | "대본 추출";
};

export default function MobileNotice({ tool }: Props) {
  return (
    <div className="sm:hidden mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-2.5">
        <span className="text-xl leading-none">💻</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-amber-900 mb-1">
            PC에서 사용을 권장해요
          </div>
          <p className="text-[12.5px] text-amber-800 leading-relaxed">
            {tool}는 영상/음성을 브라우저에서 직접 처리해요. 모바일은 <b>메모리가 부족</b>하거나 처리 중 브라우저가 <b>멈출 수 있어요</b>.
            {tool === "대본 추출" && <> AI 모델 다운로드도 크고 (300MB~2GB) 시간이 오래 걸립니다.</>}
          </p>
          <p className="text-[11.5px] text-amber-700 leading-relaxed mt-1.5">
            가능하면 컴퓨터(크롬 권장)에서 접속해주세요. 이 링크 그대로 PC 브라우저에 붙여넣으면 돼요.
          </p>
        </div>
      </div>
    </div>
  );
}
