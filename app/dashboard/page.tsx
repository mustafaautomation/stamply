import Link from "next/link"
import { Suspense } from "react"

import { RetentionChart } from "@/components/retention-chart"
import { loadDashboard } from "@/lib/handlers"
import { formatDay } from "@/lib/loyalty"

export const metadata = { title: "Overview" }

export default function DashboardPage() {
  return (
    <Suspense fallback={<p>Loading the day…</p>}>
      <Overview />
    </Suspense>
  )
}

async function Overview() {
  const { result } = await loadDashboard()
  if (!result.ok) {
    return <p role="alert">{result.error.message}</p>
  }
  const data = result.data
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs tracking-[0.18em] text-[#8a796c] uppercase">{data.tenant.plan} plan</p>
        <h1 className="font-display text-5xl tracking-tight">{data.tenant.name}</h1>
        <p className="mt-2 max-w-xl text-[#3a2e27]">{data.tenant.rewardText}</p>
        {data.tenant.readOnly ? (
          <p className="mt-3 text-sm text-[#8a3b2c]">Showcase tenant. History is real, punches are not saved.</p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active cards" value={String(data.activeCards)} />
        <Stat label="Punches today" value={String(data.punchesToday)} />
        <Stat label="Rewards redeemed" value={String(data.rewardsRedeemed)} />
      </div>
      <RetentionChart points={data.retention} />
      <section className="rounded-3xl bg-[#fffaf3] p-5 ring-1 ring-[#e4d8c8]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">Activity</h2>
          <Link href="/dashboard/activity" className="text-sm underline">
            Full log
          </Link>
        </div>
        {data.activity.length === 0 ? (
          <p className="mt-3 text-sm text-[#6e6258]">No punches yet. The first stamp is the hardest.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {data.activity.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span>{item.summary}</span>
                <span className="shrink-0 text-[#8a796c]">{formatDay(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-[#fffaf3] p-4 ring-1 ring-[#e4d8c8]">
      <p className="text-sm text-[#6e6258]">{label}</p>
      <p className="font-display text-4xl">{value}</p>
    </div>
  )
}
