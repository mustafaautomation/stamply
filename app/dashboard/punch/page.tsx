import { Suspense } from "react"

import { PunchDesk } from "@/components/punch-desk"
import { loadDashboard } from "@/lib/handlers"

export const metadata = { title: "Punch" }

export default function PunchPage() {
  return (
    <Suspense fallback={<p>Setting the stamp pad…</p>}>
      <Desk />
    </Suspense>
  )
}

async function Desk() {
  const { result } = await loadDashboard()
  return <PunchDesk readOnly={result.ok ? result.data.tenant.readOnly : false} />
}
