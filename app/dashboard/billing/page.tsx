import { Suspense } from "react"

import { BillingPanel } from "@/components/billing-panel"
import { loadDashboard, loadSession } from "@/lib/handlers"

export const metadata = { title: "Billing" }

export default function BillingPage() {
  return (
    <Suspense fallback={<p>Loading billing…</p>}>
      <Billing />
    </Suspense>
  )
}

async function Billing() {
  const [actor, loaded] = await Promise.all([loadSession(), loadDashboard()])
  if (!loaded.result.ok) return <p role="alert">{loaded.result.error.message}</p>
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-4xl">Billing</h1>
      <Suspense fallback={<p>Loading plans…</p>}>
        <BillingPanel plan={loaded.result.data.tenant.plan} readOnly={loaded.result.data.tenant.readOnly} owner={actor?.role === "owner"} />
      </Suspense>
    </div>
  )
}
