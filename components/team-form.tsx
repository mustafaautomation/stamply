"use client"

import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function TeamForm({ disabled }: { disabled: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    })
    const payload = (await response.json()) as { ok: boolean; error?: { message: string } }
    setPending(false)
    if (!payload.ok) {
      setError(payload.error?.message ?? "Could not add staff.")
      return
    }
    window.location.reload()
  }

  if (disabled) return null

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-3xl bg-[#fffaf3] p-5 ring-1 ring-[#e4d8c8]">
      <h2 className="font-display text-2xl">Add staff</h2>
      <div className="grid gap-1.5">
        <Label htmlFor="staff-name">Staff name</Label>
        <Input id="staff-name" name="name" required className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="staff-email">Staff email</Label>
        <Input id="staff-email" name="email" type="email" required className="h-11" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="staff-password">Staff password</Label>
        <Input id="staff-password" name="password" type="password" required minLength={8} className="h-11" />
      </div>
      {error ? <p role="alert" className="text-sm text-[#8a3b2c]">{error}</p> : null}
      <Button type="submit" className="h-11 w-fit" disabled={pending}>
        Add staff
      </Button>
    </form>
  )
}
