"use client"

import { useState, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"

import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const params = useSearchParams()
  const next = params.get("next") || ""
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const payload = (await response.json()) as {
      ok: boolean
      data?: { actor: { role: string } }
      error?: { message: string }
    }
    setPending(false)
    if (!payload.ok || !payload.data) {
      setError(payload.error?.message ?? "Could not sign in.")
      return
    }
    const safeNext = next.startsWith("/") ? next : ""
    if (safeNext) {
        window.location.assign(safeNext)
        return
      }
      window.location.assign(payload.data.actor.role === "super_admin" ? "/admin" : "/dashboard")
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
      </div>
      {error ? <p role="alert" className="text-sm text-[#8a3b2c]">{error}</p> : null}
      <Button type="submit" className="h-11" disabled={pending}>
        Sign in
      </Button>
      <div className="rounded-2xl bg-[#f6f0e7] p-3 text-sm text-[#6e6258]">
        <p>
          Showcase password <span className="font-medium text-[#1c1410]">{DEMO_PASSWORD}</span>
        </p>
        <ul className="mt-2 grid gap-1">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                className="underline decoration-[#d9cbbd] underline-offset-4"
                onClick={() => {
                  setEmail(account.email)
                  setPassword(DEMO_PASSWORD)
                }}
              >
                {account.role}: {account.email}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  )
}

const presets = {
  cafe: { goal: 8, reward: "A free drink on the house", primary: "#2A211C", accent: "#E25A3C" },
  salon: { goal: 6, reward: "A complimentary treatment", primary: "#3A2430", accent: "#E4B3C2" },
  gym: { goal: 10, reward: "A guest pass for a friend", primary: "#1B2620", accent: "#E0B15A" },
  other: { goal: 8, reward: "A thank-you on the house", primary: "#24312B", accent: "#C23B22" },
} as const

export function SignupForm() {
  const [industry, setIndustry] = useState<keyof typeof presets>("cafe")
  const [goal, setGoal] = useState("8")
  const [reward, setReward] = useState<string>(presets.cafe.reward)
  const [primary, setPrimary] = useState<string>(presets.cafe.primary)
  const [accent, setAccent] = useState<string>(presets.cafe.accent)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function applyIndustry(value: keyof typeof presets) {
    setIndustry(value)
    setGoal(String(presets[value].goal))
    setReward(presets[value].reward)
    setPrimary(presets[value].primary)
    setAccent(presets[value].accent)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        businessName: form.get("businessName"),
        industry,
        stampGoal: Number(goal),
        rewardText: reward,
        primaryColor: primary,
        accentColor: accent,
        city: form.get("city"),
      }),
    })
    const payload = (await response.json()) as { ok: boolean; error?: { message: string } }
    setPending(false)
    if (!payload.ok) {
      setError(payload.error?.message ?? "Could not create the program.")
      return
    }
    window.location.assign("/dashboard")
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="Your name" name="name" autoComplete="name" />
      <Field label="Work email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" />
      <Field label="Business name" name="businessName" />
      <div className="grid gap-1.5">
        <Label htmlFor="industry">Industry</Label>
        <select
          id="industry"
          className="h-11 rounded-lg border border-input bg-transparent px-3 text-sm"
          value={industry}
          onChange={(event) => applyIndustry(event.target.value as keyof typeof presets)}
        >
          <option value="cafe">Café</option>
          <option value="salon">Salon</option>
          <option value="gym">Gym</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="stamp-goal">Stamp goal</Label>
          <Input id="stamp-goal" inputMode="numeric" value={goal} onChange={(event) => setGoal(event.target.value)} className="h-11" />
        </div>
        <Field label="City" name="city" required={false} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="reward">Reward</Label>
        <Input id="reward" value={reward} onChange={(event) => setReward(event.target.value)} className="h-11" />
      </div>
      <div className="flex gap-4">
        <label className="text-sm">
          Card color
          <input className="mt-1 block h-11 w-16" type="color" value={primary} onChange={(event) => setPrimary(event.target.value)} />
        </label>
        <label className="text-sm">
          Stamp color
          <input className="mt-1 block h-11 w-16" type="color" value={accent} onChange={(event) => setAccent(event.target.value)} />
        </label>
      </div>
      {error ? <p role="alert" className="text-sm text-[#8a3b2c]">{error}</p> : null}
      <Button type="submit" className="h-11" disabled={pending}>
        Create program
      </Button>
    </form>
  )
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
  required?: boolean
}) {
  const id = name
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} autoComplete={autoComplete} required={required} className="h-11" />
    </div>
  )
}
