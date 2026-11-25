"use client"

import { useState } from "react"

import { QrImage } from "@/components/qr-image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PublicCard } from "@/lib/types"
import { prefersLightText } from "@/lib/color"

const tilts = [-8, 6, -3, 10, -6, 4, -11, 7, -2, 9, -5, 3]

export function PunchTicket({
  card,
  demo = false,
  interactive = true,
}: {
  card: PublicCard
  demo?: boolean
  interactive?: boolean
}) {
  const light = prefersLightText(card.primaryColor)
  const ink = light ? "#f6f1e8" : "#1c1410"
  const muted = light ? "rgba(246,241,232,0.72)" : "rgba(28,20,16,0.66)"
  const locked = card.readOnly || demo
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [wallet, setWallet] = useState<null | {
    provider: "apple" | "google"
    preview: string
    message: string
    downloadPath: string
  }>(null)
  const remaining = Math.max(card.stampGoal - card.stamps, 0)

  async function redeem() {
    setPending(true)
    setMessage(null)
    const response = await fetch("/api/cards/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: card.code, demo: locked, audience: "public" }),
    })
    const payload = (await response.json()) as {
      ok: boolean
      error?: { message: string }
    }
    setPending(false)
    if (!payload.ok) {
      setMessage(payload.error?.message ?? "The reward could not be redeemed.")
      return
    }
    window.location.reload()
  }

  async function openWallet(provider: "apple" | "google") {
    setPending(true)
    setMessage(null)
    const response = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: card.code, provider }),
    })
    const payload = (await response.json()) as {
      ok: boolean
      data?: { preview: string; message: string; downloadPath: string }
      error?: { message: string }
    }
    setPending(false)
    if (!payload.ok || !payload.data) {
      setMessage(payload.error?.message ?? "The pass preview could not be made.")
      return
    }
    setWallet({ provider, ...payload.data })
  }

  return (
    <div className="mx-auto w-full max-w-[420px]">
      {locked && interactive ? (
        <p className="mb-4 rounded-full bg-white/10 px-4 py-2 text-center text-sm" style={{ color: ink }}>
          Public demo · this card is read-only
        </p>
      ) : null}
      <article
        className="ticket-notch relative overflow-hidden rounded-[28px] px-6 py-7 shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        style={{ ["--ticket" as string]: "#fffaf3", background: "#fffaf3", color: "#1c1410" }}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium tracking-[0.22em] text-[#8a796c] uppercase">
              {card.city || "Loyalty"} {card.industry === "cafe" ? "café" : card.industry}
            </p>
            <h1 className="font-display mt-1 text-4xl leading-none tracking-tight">{card.businessName}</h1>
          </div>
          {card.logoUrl ? (
            <img src={card.logoUrl} alt="" className="size-14 rounded-2xl bg-[#1c1410] object-cover" />
          ) : (
            <div
              className="grid size-14 place-items-center rounded-2xl font-display text-xl text-[#f6f1e8]"
              style={{ background: card.primaryColor }}
            >
              {card.businessName.slice(0, 1)}
            </div>
          )}
        </header>
        <p className="mt-6 font-display text-3xl italic text-[#3a2e27]">{card.customerFirstName}</p>
        <p className="mt-1 text-sm text-[#6e6258]" data-testid="stamp-count">
          {card.stamps} of {card.stampGoal}
        </p>
        <div
          className="mt-5 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(card.stampGoal, 4)}, minmax(0, 1fr))` }}
          aria-hidden
        >
          {Array.from({ length: card.stampGoal }, (_, index) => {
            const filled = index < card.stamps
            return (
              <div
                key={index}
                className={filled ? "stamp filled" : "stamp"}
                style={{
                  ["--stamp-ink" as string]: "#1c1410",
                  ["--stamp-accent" as string]: card.accentColor,
                  ["--tilt" as string]: String(tilts[index % tilts.length]),
                }}
              >
                {filled ? <Seal /> : <span className="text-[10px] text-[#a8988a]">{index + 1}</span>}
              </div>
            )
          })}
        </div>
        <div className="my-6 border-t border-dashed border-[#d9cbbd]" />
        <div
          className="rounded-2xl px-4 py-3"
          style={{ background: card.rewardUnlocked ? "#f3e2b6" : "#f6f0e7" }}
        >
          <p className="text-[11px] tracking-[0.18em] text-[#8a6a2f] uppercase">
            {card.rewardUnlocked ? "Reward ready" : `${remaining} stamp${remaining === 1 ? "" : "s"} to go`}
          </p>
          <p className="mt-1 font-display text-2xl leading-tight">{card.rewardText}</p>
        </div>
        {interactive ? (
          <div className="mt-4 flex flex-col gap-2">
            {card.rewardUnlocked ? (
              <Button type="button" className="h-11" onClick={redeem} disabled={pending}>
                Redeem reward
              </Button>
            ) : null}
            {message ? (
              <p role="alert" className="text-sm text-[#8a3b2c]">
                {message}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-[#8a796c] uppercase">Card</p>
            <p className="font-mono text-sm" data-testid="card-code">
              {card.code}
            </p>
          </div>
          <QrImage path={`/c/${card.code}${demo ? "?demo=1" : ""}`} alt={`${card.businessName} card QR`} size={92} />
        </div>
      </article>
      {interactive ? (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="button" variant="secondary" className="h-11 bg-white/90" disabled={pending} onClick={() => openWallet("apple")}>
            Add to Apple Wallet
          </Button>
          <Button type="button" variant="secondary" className="h-11 bg-white/90" disabled={pending} onClick={() => openWallet("google")}>
            Add to Google Wallet
          </Button>
        </div>
      ) : null}
      <Dialog open={Boolean(wallet)} onOpenChange={(open) => !open && setWallet(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{wallet?.provider === "google" ? "Google Wallet preview" : "Apple Wallet preview"}</DialogTitle>
            <DialogDescription>{wallet?.message}</DialogDescription>
          </DialogHeader>
          {wallet ? (
            <img
              src={wallet.preview}
              alt={wallet.provider === "google" ? "Google Wallet pass preview" : "Apple Wallet pass preview"}
              className="w-full rounded-2xl"
            />
          ) : null}
          {wallet ? (
            <a className="text-sm font-medium underline" href={wallet.downloadPath}>
              Download placeholder pass
            </a>
          ) : null}
        </DialogContent>
      </Dialog>
      <p className="sr-only" style={{ color: muted }}>
        {ink}
      </p>
    </div>
  )
}

function Seal() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
      <circle cx="16" cy="16" r="10" fill="none" stroke="#1c1410" strokeWidth="1.4" />
      <path d="M10 16.5l3.2 3.2L22 11" fill="none" stroke="#1c1410" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
