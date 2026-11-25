import Link from "next/link"
import { Suspense } from "react"

import { LoginForm } from "@/components/auth-forms"
import { AuthShell } from "@/components/auth-shell"

export const metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <AuthShell title="Back behind the counter" lede="Owners, staff, and the Stamply admin use the same door.">
      <Suspense fallback={<p>Loading sign in…</p>}>
        <LoginForm />
      </Suspense>
      <p className="mt-4 text-sm">
        New shop?{" "}
        <Link href="/signup" className="underline">
          Create a program
        </Link>
      </p>
    </AuthShell>
  )
}
