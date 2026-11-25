import Link from "next/link"

import { QrImage } from "@/components/qr-image"
import { Wordmark } from "@/components/wordmark"

const cards = [
  { name: "Lumen Coffee", person: "Maya Chen", detail: "8 of 8 · reward ready", href: "/c/LUMEN-MAYA?demo=1" },
  { name: "Atelier North", person: "Nina Park", detail: "6 of 6 · gloss ready", href: "/c/ATELIER-NINA?demo=1" },
  { name: "Iron & Oak", person: "Andre Walsh", detail: "9 of 10", href: "/c/IRON-ANDRE?demo=1" },
]

export const metadata = { title: "Showcase" }

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#f3eee4] px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/">
          <Wordmark />
        </Link>
        <h1 className="font-display mt-10 text-5xl tracking-tight">A read-only look at three counters.</h1>
        <p className="mt-3 max-w-2xl text-[#3a2e27]">
          These cards already have punch history. Redeem and punch are refused, so the next visitor sees the same shop.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="rounded-3xl bg-[#fffaf3] p-5 ring-1 ring-[#e4d8c8]">
              <p className="text-xs tracking-[0.16em] text-[#8a796c] uppercase">{card.name}</p>
              <p className="font-display mt-2 text-3xl">{card.person}</p>
              <p className="mt-1 text-sm text-[#6e6258]">{card.detail}</p>
            </Link>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-start gap-3 rounded-3xl bg-[#2a211c] p-6 text-[#f6f1e8] sm:flex-row sm:items-center">
          <QrImage path="/c/LUMEN-MAYA?demo=1" alt="Demo café QR" dark="#f6f1e8" />
          <div>
            <Link href="/c/LUMEN-MAYA?demo=1" className="font-display text-3xl" aria-label="Demo café QR">
              Demo café QR
            </Link>
            <p className="mt-2 max-w-sm text-sm text-[#f6f1e8]/75">Scan or tap. The card opens and the stamps do not move.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
