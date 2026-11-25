import type { Metadata } from "next"
import { Fraunces, Outfit } from "next/font/google"

import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
})

export const metadata: Metadata = {
  title: {
    default: "Stamply",
    template: "%s · Stamply",
  },
  description:
    "White-label loyalty punch cards for cafés, salons, and gyms. Staff stamp a card, regulars watch the reward unlock, and the pass lives on their phone.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  )
}
