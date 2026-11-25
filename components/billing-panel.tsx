"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import type { PlanId } from "@/lib/types"

export function BillingPanel({
  plan,
  readOnly,
  owner,
}: {
  plan: PlanId
  readOnly: boolean
  owner: boolean
}) {
  const params = useSearchParams()
  const router = useRouter()
  const checkout = params.get("checkout")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const plans: { id: PlanId; name: string; price: string; points: string[] }[] = [
    {
      id: "starter",
      name: "Starter",
      price: "$29",
      points: ["200 active cards", "3 staff logins", "Punch screen, wallet preview, activity log"],
    },
    {
      id: "pro",
      name: "Pro",
      price: "$79",
      points: ["5,000 active cards", "25 staff logins", "Live Groq or Gemini reward copy"],
    },
  ]

  async function choose(next: PlanId) {
    setPending(true)
    setError(null)
    const checkoutResponse = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: next }),
    })
    const checkoutPayload = (await checkoutResponse.json()) as {
      ok: boolean
      data?: { mode: string; url?: string | null; message?: string }
      error?: { message: string }
    }
    if (!checkoutPayload.ok || !checkoutPayload.data?.url) {
      setPending(false)
      setError(checkoutPayload.error?.message ?? "Checkout could not start.")
      return
    }
    if (checkoutPayload.data.mode === "live" && checkoutPayload.data.url) {
      window.location.assign(checkoutPayload.data.url)
      return
    }
    const activate = await fetch("/api/billing/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: next }),
    })
    const payload = (await activate.json()) as { ok: boolean; error?: { message: string } }
    setPending(false)
    if (!payload.ok) {
      setError(payload.error?.message ?? "The plan was not changed.")
      return
    }
    router.push("/dashboard/billing")
    router.refresh()
  }

  return (
    <div className="grid gap-4">
      {checkout ? (
        <p className="rounded-2xl bg-[#f3e2b6] px-4 py-3 text-sm">
          Mock checkout for {checkout}. No card is charged. Confirm below to apply the plan in this browser.
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((item) => (
          <article key={item.id} className="rounded-3xl bg-[#fffaf3] p-5 ring-1 ring-[#e4d8c8]">
            <p className="text-xs tracking-[0.16em] text-[#8a796c] uppercase">{item.id === plan ? "Current plan" : "Plan"}</p>
            <h2 className="font-display mt-2 text-4xl">{item.name}</h2>
            <p className="mt-1 text-2xl">{item.price}<span className="text-base text-[#6e6258]">/mo</span></p>
            <ul className="mt-4 grid gap-1 text-sm text-[#3a2e27]">
              {item.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            {owner ? (
              <Button type="button" className="mt-5 h-11" disabled={pending || readOnly || item.id === plan} onClick={() => choose(item.id)}>
                {item.id === plan ? "Current" : `Choose ${item.name}`}
              </Button>
            ) : null}
          </article>
        ))}
      </div>
      {readOnly ? <p className="text-sm text-[#6e6258]">Showcase billing is display-only.</p> : null}
      {!owner ? <p className="text-sm text-[#6e6258]">Ask the owner to change the plan.</p> : null}
      {error ? <p role="alert" className="text-sm text-[#8a3b2c]">{error}</p> : null}
      <p className="text-sm text-[#6e6258]">
        With Stripe test keys, Choose opens Checkout. Without them, Stamply applies the plan locally and never asks for a card.
      </p>
    </div>
  )
}
