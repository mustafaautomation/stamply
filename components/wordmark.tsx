export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-xl tracking-tight ${light ? "text-[#f6f1e8]" : "text-[#1c1410]"}`}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <circle cx="16" cy="16" r="14" fill={light ? "#e7c98a" : "#1c1410"} />
        <circle cx="16" cy="16" r="8" fill="none" stroke={light ? "#1c1410" : "#f4efe6"} strokeWidth="1.6" />
        <path d="M11 16.5l3 3 7-7" fill="none" stroke={light ? "#1c1410" : "#e25a3c"} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      Stamply
    </span>
  )
}
