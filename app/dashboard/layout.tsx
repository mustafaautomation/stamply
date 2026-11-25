import { redirect } from "next/navigation"
import { Suspense, type ReactNode } from "react"

import { MerchantFrame } from "@/components/merchant-frame"
import { loadSession } from "@/lib/handlers"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8">Opening the counter…</p>}>
      <Authed>{children}</Authed>
    </Suspense>
  )
}

async function Authed({ children }: { children: ReactNode }) {
  const actor = await loadSession()
  if (!actor) redirect("/login?next=/dashboard")
  if (actor.role === "super_admin") redirect("/admin")
  if (!actor.tenantId) redirect("/login")
  return <MerchantFrame actor={actor}>{children}</MerchantFrame>
}
