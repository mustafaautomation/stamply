import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { LogoutLink } from "@/components/logout-link"
import { Wordmark } from "@/components/wordmark"
import { loadAdmin } from "@/lib/handlers"

export const metadata = { title: "Admin" }

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading tenants…</p>}>
      <Admin />
    </Suspense>
  )
}

async function Admin() {
  const { actor, result } = await loadAdmin()
  if (!actor) redirect("/login?next=/admin")
  if (!result.ok) redirect("/dashboard")
  const data = result.data
  return (
    <div className="min-h-screen bg-[#f4efe6] px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Wordmark />
          </Link>
          <LogoutLink />
        </div>
        <h1 className="font-display mt-8 text-5xl">Every tenant</h1>
        <p className="mt-2 text-[#6e6258]">
          {data.totals.tenants} programs · {data.totals.cards} cards · {data.totals.punchesToday} punches today · {data.totals.rewardsRedeemed} rewards redeemed
        </p>
        <div className="mt-6 overflow-x-auto rounded-3xl bg-[#fffaf3] ring-1 ring-[#e4d8c8]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[#6e6258]">
              <tr>
                <th className="px-4 py-3 font-medium">Shop</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Cards</th>
                <th className="px-4 py-3 font-medium">Today</th>
                <th className="px-4 py-3 font-medium">Redeemed</th>
                <th className="px-4 py-3 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.map((tenant) => (
                <tr key={tenant.id} className="border-t border-[#efe6d8]">
                  <td className="px-4 py-3">
                    {tenant.name}
                    {tenant.readOnly ? <span className="ml-2 text-xs text-[#8a796c]">showcase</span> : null}
                  </td>
                  <td className="px-4 py-3">{tenant.plan}</td>
                  <td className="px-4 py-3">{tenant.cards}</td>
                  <td className="px-4 py-3">{tenant.punchesToday}</td>
                  <td className="px-4 py-3">{tenant.rewardsRedeemed}</td>
                  <td className="px-4 py-3">{tenant.owners.map((owner) => owner.email).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="font-display mt-10 text-3xl">Outbox</h2>
        <ul className="mt-3 grid gap-2">
          {data.emails.length === 0 ? <li className="text-sm text-[#6e6258]">No mail yet.</li> : null}
          {data.emails.map((email) => (
            <li key={email.id} className="rounded-2xl bg-[#fffaf3] px-4 py-3 text-sm ring-1 ring-[#e4d8c8]">
              <p className="font-medium">{email.subject}</p>
              <p className="text-[#6e6258]">To {email.to}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
