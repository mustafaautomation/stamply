import Link from "next/link"
import type { ReactNode } from "react"

import { Wordmark } from "@/components/wordmark"

export function AuthShell({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-[#2a211c] px-6 py-8 text-[#f6f1e8] lg:px-12 lg:py-12">
        <Link href="/">
          <Wordmark light />
        </Link>
        <p className="font-display mt-16 max-w-md text-5xl leading-none tracking-tight">{title}</p>
        <p className="mt-4 max-w-sm text-[#f6f1e8]/75">{lede}</p>
      </div>
      <div className="flex items-center px-6 py-10 lg:px-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
