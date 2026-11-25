"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { MerchantCard } from "@/lib/types"

type ErrorBody = { code?: string; message?: string; canCreate?: boolean; retryAfterSeconds?: number }

export function PunchDesk({ readOnly }: { readOnly: boolean }) {
  const [contact, setContact] = useState("")
  const [name, setName] = useState("")
  const [card, setCard] = useState<MerchantCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)

  async function lookup() {
    setPending(true)
    setError(null)
    const response = await fetch("/api/cards/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact, name }),
    })
    const payload = (await response.json()) as { ok: boolean; data?: MerchantCard; error?: ErrorBody }
    setPending(false)
    if (!payload.ok || !payload.data) {
      setCard(null)
      setError(payload.error?.message ?? "No card found.")
      return
    }
    setCard(payload.data)
  }

  async function punch(force: boolean) {
    if (!card) return
    setPending(true)
    setError(null)
    const response = await fetch("/api/cards/punch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: card.code, confirm: force }),
    })
    const payload = (await response.json()) as { ok: boolean; data?: MerchantCard; error?: ErrorBody }
    setPending(false)
    if (!payload.ok || !payload.data) {
      if (payload.error?.code === "COOLDOWN") {
        setConfirm(payload.error?.message ?? "Confirm the extra stamp.")
        return
      }
      setError(payload.error?.message ?? "The stamp did not land.")
      return
    }
    setConfirm(null)
    setCard(payload.data)
  }

  async function redeem() {
    if (!card) return
    setPending(true)
    setError(null)
    const response = await fetch("/api/cards/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: card.code, audience: "staff" }),
    })
    const payload = (await response.json()) as { ok: boolean; error?: ErrorBody }
    setPending(false)
    if (!payload.ok) {
      setError(payload.error?.message ?? "Could not redeem.")
      return
    }
    setCard({ ...card, stamps: 0, rewardUnlocked: false, rewardsRedeemed: card.rewardsRedeemed + 1 })
  }

  async function scan() {
    setScanNote(null)
    const Detector = (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setScanNote("This browser has no QR detector. Type the code, or paste it from the card.")
      return
    }
    setScanning(true)
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    const video = document.createElement("video")
    video.srcObject = stream
    await video.play()
    const detector = new Detector({ formats: ["qr_code"] })
    let ticks = 0
    const timer = window.setInterval(async () => {
      ticks += 1
      const codes = await detector.detect(video).catch(() => [])
      const raw = codes[0]?.rawValue
      if (raw || ticks > 40) {
        window.clearInterval(timer)
        stream.getTracks().forEach((track) => track.stop())
        setScanning(false)
        if (raw) {
          const match = raw.match(/\/c\/([^/?#]+)/)
          setContact(match ? decodeURIComponent(match[1]) : raw)
          setScanNote("Code captured. Find the card to stamp it.")
        } else {
          setScanNote("No code in frame. Try again, or type it.")
        }
      }
    }, 250)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <section className="rounded-3xl bg-[#fffaf3] p-5 ring-1 ring-[#e4d8c8]">
        <h1 className="font-display text-4xl tracking-tight">Punch a card</h1>
        <p className="mt-2 text-sm text-[#6e6258]">
          Look up a regular by phone, email, or the code on their card. A second stamp inside the cooldown asks you to confirm.
        </p>
        {readOnly ? (
          <p className="mt-3 rounded-2xl bg-[#f3e2b6] px-3 py-2 text-sm">
            This showcase is read-only. Create your own program to stamp cards.
          </p>
        ) : null}
        <div className="mt-5 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="contact">Phone, email, or card code</Label>
            <Input id="contact" value={contact} onChange={(event) => setContact(event.target.value)} className="h-11" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="customer-name">Customer name</Label>
            <Input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} className="h-11" placeholder="Only needed for a new card" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-11" onClick={lookup} disabled={pending}>
              Find or create card
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={scan} disabled={pending || scanning}>
              {scanning ? "Looking for a QR…" : "Scan QR"}
            </Button>
          </div>
          {scanNote ? <p className="text-sm text-[#6e6258]">{scanNote}</p> : null}
          {error ? (
            <p role="alert" className="text-sm text-[#8a3b2c]">
              {error}
            </p>
          ) : null}
        </div>
      </section>
      <section className="rounded-3xl bg-[#1c1410] p-5 text-[#f6f1e8]">
        {card ? (
          <div>
            <p className="text-xs tracking-[0.18em] text-[#e7c98a] uppercase">{card.businessName}</p>
            <h2 className="font-display mt-2 text-4xl">{card.customerName}</h2>
            <p className="mt-1 text-sm text-[#f6f1e8]/70">
              {card.email || "No email"} · {card.phone || "No phone"}
            </p>
            <p className="font-display mt-6 text-6xl" data-testid="stamp-count">
              {card.stamps} of {card.stampGoal}
            </p>
            {card.rewardUnlocked ? <p className="mt-2 text-[#e7c98a]">Reward ready</p> : null}
            <p className="mt-2 max-w-sm text-sm text-[#f6f1e8]/75">{card.rewardText}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" className="h-12 bg-[#e25a3c] text-white hover:bg-[#e25a3c]/90" disabled={pending} onClick={() => punch(false)}>
                Punch
              </Button>
              {card.rewardUnlocked ? (
                <Button type="button" variant="secondary" className="h-12" disabled={pending} onClick={redeem}>
                  Redeem reward
                </Button>
              ) : null}
              <a className="inline-flex h-12 items-center px-2 text-sm underline" href={`/c/${card.code}`}>
                Open customer card
              </a>
            </div>
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center text-center">
            <div>
              <p className="font-display text-3xl">The counter is clear</p>
              <p className="mt-2 text-sm text-[#f6f1e8]/70">Find a regular and the stamp pad shows up here.</p>
            </div>
          </div>
        )}
      </section>
      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Punch again?</DialogTitle>
            <DialogDescription>{confirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => punch(true)} disabled={pending}>
              Punch anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
