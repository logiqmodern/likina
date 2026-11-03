/**
 * Text wordmark until the client's SVG logo is in place (OPEN-QUESTIONS: logo).
 * Max 40px high.
 */
export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className={`flex h-10 flex-col justify-center leading-none ${onDark ? "text-white" : "text-ink"}`}>
      <span className="text-[24px] font-extrabold tracking-[0.06em]">LIKINA</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Art Gallery</span>
    </span>
  );
}
