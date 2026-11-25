import type { PlanId } from "@/lib/types"

export function integrationStatus() {
  const supabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  )
  return {
    database: supabase ? "supabase" : "mock",
    stripe: process.env.STRIPE_SECRET_KEY ? "test" : "mock",
    email: process.env.RESEND_API_KEY ? "resend" : "mock",
    ai: process.env.GROQ_API_KEY ? "groq" : process.env.GEMINI_API_KEY ? "gemini" : "mock",
    wallet: "mock",
  }
}

export async function startCheckout(input: {
  plan: PlanId
  tenantId: string
  email: string
  origin: string
}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      mode: "mock" as const,
      url: `${input.origin}/dashboard/billing?checkout=${input.plan}`,
    }
  }
  const price = input.plan === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_STARTER
  if (!price) {
    return {
      mode: "mock" as const,
      url: `${input.origin}/dashboard/billing?checkout=${input.plan}`,
      message: "Stripe is configured without a price id, so checkout stays in mock mode.",
    }
  }
  const Stripe = (await import("stripe")).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.email,
    client_reference_id: input.tenantId,
    line_items: [{ price, quantity: 1 }],
    success_url: `${input.origin}/dashboard/billing?checkout=${input.plan}&stripe=success`,
    cancel_url: `${input.origin}/dashboard/billing?stripe=cancel`,
    metadata: { tenantId: input.tenantId, plan: input.plan },
  })
  return { mode: "live" as const, url: session.url }
}
