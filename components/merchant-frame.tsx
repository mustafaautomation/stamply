"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { Wordmark } from "@/components/wordmark"
import type { Actor } from "@/lib/types"

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/punch", label: "Punch" },
  { href: "/dashboard/cards", label: "Cards" },
  { href: "/dashboard/activity", label: "Activity" },
  { href: "/dashboard/program", label: "Program", owner: true },
  { href: "/dashboard/team", label: "Team", owner: true },
  { href: "/dashboard/billing", label: "Billing", owner: true },
]

export function MerchantFrame({ actor, children }: { actor: Actor; children: ReactNode }) {
  const pathname = usePathname()
  const visible = links.filter((link) => !link.owner || actor.role === "owner")

  return (
    <div className="min-h-screen bg-[#f4efe6] text-[#1c1410] md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden bg-[#1c1410] text-[#f6f1e8] md:flex md:flex-col md:justify-between md:px-5 md:py-6">
        <div>
          <Link href="/">
            <Wordmark light />
          </Link>
          <nav className="mt-10 grid gap-1">
            {visible.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3 py-2 text-sm ${pathname === link.href ? "bg-white/10" : "text-[#f6f1e8]/75 hover:bg-white/5"}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <Logout name={actor.name} email={actor.email} />
      </aside>
      <div>
        <header className="flex items-center justify-between border-b border-[#e4d8c8] bg-[#fffaf3] px-4 py-3 md:hidden">
          <Link href="/">
            <Wordmark />
          </Link>
          <Logout name={actor.name} email={actor.email} compact />
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-[#e4d8c8] bg-[#fffaf3] px-3 py-2 md:hidden">
          {visible.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${pathname === link.href ? "bg-[#1c1410] text-[#f6f1e8]" : "bg-[#efe6d8]"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}

function Logout({ name, email, compact = false }: { name: string; email: string; compact?: boolean }) {
  return (
    <form
      action="/api/auth/logout"
      method="post"
      onSubmit={async (event) => {
        event.preventDefault()
        await fetch("/api/auth/logout", { method: "POST" })
        window.location.assign("/")
      }}
      className={compact ? "" : "text-sm"}
    >
      {compact ? null : (
        <p className="mb-2 text-[#f6f1e8]/70">
          {name}
          <span className="block text-xs">{email}</span>
        </p>
      )}
      <button type="submit" className="text-sm underline underline-offset-4">
        Log out
      </button>
    </form>
  )
}
