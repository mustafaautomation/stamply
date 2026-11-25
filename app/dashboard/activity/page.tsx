import { Suspense } from "react"

import { loadActivity } from "@/lib/handlers"
import { formatDay } from "@/lib/loyalty"

export const metadata = { title: "Activity" }

export default function ActivityPage() {
  return (
    <Suspense fallback={<p>Loading the log…</p>}>
      <Log />
    </Suspense>
  )
}

async function Log() {
  const { result } = await loadActivity()
  if (!result.ok) return <p role="alert">{result.error.message}</p>
  return (
    <div>
      <h1 className="font-display text-4xl">Activity</h1>
      {result.data.length === 0 ? (
        <p className="mt-3 text-sm text-[#6e6258]">Nothing has happened yet.</p>
      ) : (
        <ol className="mt-6 grid gap-3">
          {result.data.map((item) => (
            <li key={item.id} className="rounded-2xl bg-[#fffaf3] px-4 py-3 ring-1 ring-[#e4d8c8]">
              <p>{item.summary}</p>
              <p className="text-xs text-[#8a796c]">
                {item.action} · {formatDay(item.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
