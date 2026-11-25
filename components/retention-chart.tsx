import type { RetentionPoint } from "@/lib/types"

export function RetentionChart({ points }: { points: RetentionPoint[] }) {
  const width = 640
  const height = 220
  const pad = 28
  const max = 100
  const step = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0
  const coords = points.map((point, index) => {
    const x = pad + index * step
    const y = height - pad - (point.rate / max) * (height - pad * 2)
    return { ...point, x, y }
  })
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
  const area = `${line} L ${coords.at(-1)?.x ?? pad} ${height - pad} L ${pad} ${height - pad} Z`
  const empty = points.every((point) => point.rate === 0)

  return (
    <figure className="rounded-3xl bg-[#fffaf3] p-4 ring-1 ring-[#e4d8c8]">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-display text-2xl">Retention</span>
        <span className="text-sm text-[#6e6258]">Regulars who came back, by week</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" role="img" aria-label="Eight week retention">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = height - pad - (tick / 100) * (height - pad * 2)
          return (
            <g key={tick}>
              <line x1={pad} x2={width - pad} y1={y} y2={y} stroke="#eadfD2" />
              <text x={0} y={y + 4} fontSize="11" fill="#8a796c">
                {tick}
              </text>
            </g>
          )
        })}
        <path d={area} fill="#2f4a3c" opacity="0.16" />
        <path d={line} fill="none" stroke="#2f4a3c" strokeWidth="3" strokeLinejoin="round" />
        {coords.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4" fill="#c23b22" />
            <text x={point.x} y={height - 8} textAnchor="middle" fontSize="11" fill="#6e6258">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
      {empty ? <p className="text-sm text-[#6e6258]">Retention appears once regulars come back a second time.</p> : null}
    </figure>
  )
}
