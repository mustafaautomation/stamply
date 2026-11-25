"use client"

import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TenantView } from "@/lib/types"

export function ProgramForm({ tenant, owner }: { tenant: TenantView; owner: boolean }) {
  const [reward, setReward] = useState(tenant.rewardText)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!owner) return
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const file = form.get("logo")
    let logoUrl: string | undefined
    if (file instanceof File && file.size > 0) {
      if (file.size > 120_000) {
        setPending(false)
        setError("Logo is too large. Use an image under 120KB.")
        return
      }
      logoUrl = await readFile(file)
    }
    const response = await fetch("/api/program", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        city: form.get("city"),
        tagline: form.get("tagline"),
        stampGoal: Number(form.get("stampGoal")),
        rewardText: reward,
        primaryColor: form.get("primaryColor"),
        accentColor: form.get("accentColor"),
        logoUrl,
      }),
    })
    const payload = (await response.json()) as { ok: boolean; error?: { message: string } }
    setPending(false)
    if (!payload.ok) {
      setError(payload.error?.message ?? "Could not save.")
      return
    }
    window.location.reload()
  }

  async function suggest() {
    setPending(true)
    const response = await fetch("/api/ai/reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: tenant.name,
        industry: tenant.industry,
        stampGoal: tenant.stampGoal,
      }),
    })
    const payload = (await response.json()) as {
      ok: boolean
      data?: { suggestions: string[]; message?: string; source: string }
    }
    setPending(false)
    if (!payload.ok || !payload.data) return
    setSuggestions(payload.data.suggestions)
    setNote(payload.data.message || `Lines from ${payload.data.source}.`)
  }

  return (
    <form onSubmit={save} className="grid gap-4 rounded-3xl bg-[#fffaf3] p-5 ring-1 ring-[#e4d8c8]">
      <div className="grid gap-1.5">
        <Label htmlFor="business-name">Business name</Label>
        <Input id="business-name" name="name" defaultValue={tenant.name} className="h-11" disabled={!owner} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={tenant.city} className="h-11" disabled={!owner} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="goal">Stamp goal</Label>
          <Input id="goal" name="stampGoal" defaultValue={String(tenant.stampGoal)} className="h-11" disabled={!owner} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tagline">Tagline</Label>
        <Input id="tagline" name="tagline" defaultValue={tenant.tagline} className="h-11" disabled={!owner} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="reward-text">Reward</Label>
        <Input id="reward-text" value={reward} onChange={(event) => setReward(event.target.value)} className="h-11" disabled={!owner} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={suggest} disabled={pending}>
          Suggest reward lines
        </Button>
        {suggestions.map((line) => (
          <button key={line} type="button" className="rounded-full bg-[#efe6d8] px-3 py-1 text-left text-sm" onClick={() => setReward(line)}>
            {line}
          </button>
        ))}
      </div>
      {note ? <p className="text-sm text-[#6e6258]">{note}</p> : null}
      <div className="flex flex-wrap gap-4">
        <label className="text-sm">
          Card color
          <input className="mt-1 block h-10" name="primaryColor" type="color" defaultValue={tenant.primaryColor} disabled={!owner} />
        </label>
        <label className="text-sm">
          Stamp color
          <input className="mt-1 block h-10" name="accentColor" type="color" defaultValue={tenant.accentColor} disabled={!owner} />
        </label>
        <label className="text-sm">
          Logo
          <input className="mt-1 block text-sm" name="logo" type="file" accept="image/*" disabled={!owner} />
        </label>
      </div>
      {error ? <p role="alert" className="text-sm text-[#8a3b2c]">{error}</p> : null}
      {owner ? (
        <Button type="submit" className="h-11 w-fit" disabled={pending || tenant.readOnly}>
          Save program
        </Button>
      ) : (
        <p className="text-sm text-[#6e6258]">Staff can view the program. The owner edits it.</p>
      )}
      {tenant.readOnly ? <p className="text-sm">Showcase programs stay as they were seeded.</p> : null}
    </form>
  )
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
