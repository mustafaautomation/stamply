import Link from "next/link"
import { Suspense } from "react"

import { PunchTicket } from "@/components/punch-ticket"
import { Wordmark } from "@/components/wordmark"
import { loadPublicCard } from "@/lib/handlers"
import { prefersLightText } from "@/lib/color"

export default function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ demo?: string }>
}) {
  return (
    <Suspense fallback={<CardFallback />}>
      <CardBody params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function CardBody({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ demo?: string }>
}) {
  const { code } = await params
  const query = await searchParams
  const demo = query.demo === "1"
  const result = await loadPublicCard(code, demo)
  if (!result.ok) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#1c1410] px-4 text-[#f6f1e8]">
        <div className="max-w-md text-center">
          <Wordmark light />
          <h1 className="font-display mt-6 text-4xl">That card is not on the rail.</h1>
          <p className="mt-2 text-[#f6f1e8]/70">Check the code with the shop. Cards are private until someone shares the link.</p>
          <Link href="/" className="mt-6 inline-block underline">
            Back to Stamply
          </Link>
        </div>
      </div>
    )
  }
  const card = result.data
  const light = prefersLightText(card.primaryColor)
  return (
    <div className="min-h-screen px-4 py-6" style={{ background: card.primaryColor, color: light ? "#f6f1e8" : "#1c1410" }}>
      <div className="mx-auto flex max-w-lg items-center justify-between">
        <Link href="/">
          <Wordmark light={light} />
        </Link>
        <Link href="/demo" className="text-sm underline">
          Showcase
        </Link>
      </div>
      <div className="mx-auto mt-8 max-w-lg pb-10">
        <PunchTicket card={card} demo={demo} />
        <p className="mt-6 text-center text-sm opacity-80">{card.tagline}</p>
      </div>
    </div>
  )
}

function CardFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#2a211c] text-[#f6f1e8]">
      <p>Pulling the card…</p>
    </div>
  )
}
