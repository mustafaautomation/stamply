import Link from "next/link"
import { Suspense } from "react"

import { loadCards } from "@/lib/handlers"

export const metadata = { title: "Cards" }

export default function CardsPage() {
  return (
    <Suspense fallback={<p>Loading cards…</p>}>
      <Cards />
    </Suspense>
  )
}

async function Cards() {
  const { result } = await loadCards()
  if (!result.ok) return <p role="alert">{result.error.message}</p>
  if (result.data.length === 0) {
    return (
      <div>
        <h1 className="font-display text-4xl">Cards</h1>
        <p className="mt-2 text-[#6e6258]">No cards yet. Punch the first regular to start one.</p>
        <Link href="/dashboard/punch" className="mt-4 inline-block underline">
          Go to the punch desk
        </Link>
      </div>
    )
  }
  return (
    <div>
      <h1 className="font-display text-4xl">Cards</h1>
      <ul className="mt-6 grid gap-3">
        {result.data.map((card) => (
          <li key={card.code} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-[#fffaf3] px-4 py-4 ring-1 ring-[#e4d8c8]">
            <div>
              <p className="font-medium">{card.customerName}</p>
              <p className="text-sm text-[#6e6258]">
                {card.stamps} of {card.stampGoal}
                {card.rewardUnlocked ? " · Reward ready" : ""} · {card.code}
              </p>
            </div>
            <Link href={`/c/${card.code}`} className="text-sm underline">
              Open {card.customerFirstName}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
