import Link from "next/link"

import { PunchTicket } from "@/components/punch-ticket"
import { QrImage } from "@/components/qr-image"
import { Wordmark } from "@/components/wordmark"
import type { PublicCard } from "@/lib/types"

const preview: PublicCard = {
  code: "LUMEN-MAYA",
  businessName: "Lumen Coffee",
  industry: "cafe",
  logoUrl: "/marks/lumen.svg",
  primaryColor: "#2A211C",
  accentColor: "#E25A3C",
  stampGoal: 8,
  stamps: 5,
  rewardText: "Free drip flight for your regular mug",
  rewardUnlocked: false,
  rewardsRedeemed: 0,
  customerFirstName: "Maya",
  customerName: "Maya Chen",
  city: "Portland",
  tagline: "Division Street.",
  readOnly: true,
  showcase: true,
}

const shops = [
  { name: "Lumen Coffee", city: "Portland", kind: "Café", href: "/c/LUMEN-MAYA?demo=1", note: "8 stamps, then a drip flight." },
  { name: "Atelier North", city: "Seattle", kind: "Salon", href: "/c/ATELIER-NINA?demo=1", note: "The sixth visit gets a gloss." },
  { name: "Iron & Oak", city: "Austin", kind: "Gym", href: "/c/IRON-ANDRE?demo=1", note: "Ten sessions, then a guest week." },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f3eee4] text-[#1c1410]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/demo" className="hidden sm:inline">
            Showcase
          </Link>
          <Link href="/login">Sign in</Link>
          <Link href="/signup" className="rounded-full bg-[#1c1410] px-4 py-2 text-[#f6f1e8]">
            Start a program
          </Link>
        </nav>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:py-16">
          <div>
            <p className="text-xs tracking-[0.22em] text-[#8a3b2c] uppercase">For the counter, not the coupon app</p>
            <h1 className="font-display mt-3 text-5xl leading-[0.95] tracking-tight md:text-7xl">
              A punch card your regulars keep in their pocket.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[#3a2e27]">
              Stamply gives cafés, salons, and gyms a branded card, a staff punch screen, and a wallet pass. No plastic printer. No wallet certificates required to try it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-full bg-[#c23b22] px-5 py-3 text-[#fffaf3]">
                Create a program
              </Link>
              <Link href="/c/LUMEN-MAYA?demo=1" className="rounded-full border border-[#1c1410] px-5 py-3">
                Open the café card
              </Link>
            </div>
          </div>
          <div className="rounded-[36px] bg-[#2a211c] px-4 py-8 md:px-8">
            <PunchTicket card={preview} interactive={false} />
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[280px_1fr] md:items-center">
          <Link
            href="/c/LUMEN-MAYA?demo=1"
            aria-label="Demo café QR"
            className="grid justify-items-center rounded-[28px] bg-[#fffaf3] p-6 ring-1 ring-[#e4d8c8]"
          >
            <QrImage path="/c/LUMEN-MAYA?demo=1" alt="QR code for the Lumen Coffee demo card" />
            <span className="mt-3 font-display text-2xl">Demo café QR</span>
            <span className="text-sm text-[#6e6258]">Opens Maya’s card. Nothing is written.</span>
          </Link>
          <div>
            <h2 className="font-display text-4xl tracking-tight">Three shops, already stamped.</h2>
            <p className="mt-3 max-w-xl text-[#3a2e27]">
              The public demo is read-only. Wander the café, salon, and gym, then start your own program when you want a stamp that sticks.
            </p>
            <div className="mt-6 grid gap-3">
              {shops.map((shop) => (
                <Link key={shop.name} href={shop.href} className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-[#e4d8c8]">
                  <span>
                    <span className="block font-medium">{shop.name}</span>
                    <span className="text-sm text-[#6e6258]">{shop.city} · {shop.kind}</span>
                  </span>
                  <span className="text-sm">{shop.note}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="bg-[#1c1410] text-[#f6f1e8]">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
            {[
              ["1", "Brand the card", "Logo, colors, stamp goal, and the line a regular actually wants."],
              ["2", "Staff punch once", "Phone, email, or a QR. A second stamp too soon asks for a confirm."],
              ["3", "Reward unlocks", "The card fills, the reward is ready, and a placeholder wallet pass downloads."],
            ].map(([step, title, body]) => (
              <div key={step}>
                <p className="font-display text-5xl text-[#e7c98a]">{step}</p>
                <h2 className="mt-2 text-2xl">{title}</h2>
                <p className="mt-2 text-[#f6f1e8]/75">{body}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-4xl tracking-tight">Starter and Pro, in test mode.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-3xl bg-[#fffaf3] p-6 ring-1 ring-[#e4d8c8]">
              <h3 className="font-display text-3xl">Starter · $29</h3>
              <p className="mt-2 text-[#3a2e27]">200 cards, 3 staff, the punch desk, and mock wallet passes.</p>
            </article>
            <article className="rounded-3xl bg-[#2f4a3c] p-6 text-[#f6f1e8]">
              <h3 className="font-display text-3xl">Pro · $79</h3>
              <p className="mt-2 text-[#f6f1e8]/80">5,000 cards, 25 staff, and live reward copy when Groq or Gemini is connected.</p>
            </article>
          </div>
          <p className="mt-4 text-sm text-[#6e6258]">No keys, no charge. Stripe test mode turns on when you add a secret key.</p>
        </section>
      </main>
      <footer className="border-t border-[#e4d8c8] px-4 py-8 text-sm text-[#6e6258]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Wordmark />
          <p>Loyalty punch cards. Not a payments wallet.</p>
        </div>
      </footer>
    </div>
  )
}
