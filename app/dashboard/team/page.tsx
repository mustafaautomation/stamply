import { Suspense } from "react"

import { TeamForm } from "@/components/team-form"
import { loadSession, loadTeam } from "@/lib/handlers"

export const metadata = { title: "Team" }

export default function TeamPage() {
  return (
    <Suspense fallback={<p>Loading the team…</p>}>
      <Team />
    </Suspense>
  )
}

async function Team() {
  const [actor, loaded] = await Promise.all([loadSession(), loadTeam()])
  if (!loaded.result.ok) return <p role="alert">{loaded.result.error.message}</p>
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="font-display text-4xl">Team</h1>
        <ul className="mt-4 grid gap-2">
          {loaded.result.data.map((person) => (
            <li key={person.id} className="rounded-2xl bg-[#fffaf3] px-4 py-3 ring-1 ring-[#e4d8c8]">
              <p className="font-medium">{person.name}</p>
              <p className="text-sm text-[#6e6258]">
                {person.role} · {person.email}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <TeamForm disabled={actor?.role !== "owner"} />
    </div>
  )
}
