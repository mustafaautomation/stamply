import { Suspense } from "react"

import { ProgramForm } from "@/components/program-form"
import { loadDashboard, loadSession } from "@/lib/handlers"

export const metadata = { title: "Program" }

export default function ProgramPage() {
  return (
    <Suspense fallback={<p>Loading the program…</p>}>
      <Program />
    </Suspense>
  )
}

async function Program() {
  const [actor, loaded] = await Promise.all([loadSession(), loadDashboard()])
  if (!loaded.result.ok || !actor) return <p role="alert">Sign in again to edit the program.</p>
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-4xl">Program</h1>
      <ProgramForm tenant={loaded.result.data.tenant} owner={actor.role === "owner"} />
    </div>
  )
}
