import Link from "next/link"

import { SignupForm } from "@/components/auth-forms"
import { AuthShell } from "@/components/auth-shell"

export const metadata = { title: "Create a program" }

export default function SignupPage() {
  return (
    <AuthShell title="Open a card for the regulars" lede="Name the shop, set the stamp goal, and write the reward. You can change all of it later.">
      <SignupForm />
      <p className="mt-4 text-sm">
        Already stamping? <Link href="/login" className="underline">Sign in</Link>
      </p>
    </AuthShell>
  )
}
