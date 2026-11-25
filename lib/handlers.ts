import { sendEmail, suggestRewardCopy } from "@/lib/integrations"
import { integrationStatus, startCheckout } from "@/lib/billing"
import {
  addStaff,
  adminOverview,
  dashboard,
  getSeed,
  listActivity,
  listCards,
  listTeam,
  login,
  lookupCard,
  merchantCard,
  publicCard,
  punchCard,
  redeemCard,
  setPlan,
  signup,
  updateProgram,
} from "@/lib/loyalty"
import { clearSession, currentActor, getDelta, readJson, setSession, withMutation, withRead } from "@/lib/request-store"
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase"
import { supabaseLogin, supabaseLogout, supabaseMutate, supabaseSignup } from "@/lib/supabase-actions"
import type { Industry, PlanId } from "@/lib/types"
import { walletProvider, type WalletKind } from "@/lib/wallet"

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function originOf(req: Request) {
  const url = new URL(req.url)
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "")
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host
  return `${proto}://${host}`
}

function industryOf(value: unknown): Industry {
  return value === "salon" || value === "gym" || value === "other" || value === "cafe" ? value : "cafe"
}

export async function loginHandler(req: Request) {
  if (supabaseConfigured()) return supabaseLogin(req)
  return withMutation(req, async () => {
    const body = await readJson(req)
    const result = login(getSeed(), getDelta(), text(body.email), typeof body.password === "string" ? body.password : "")
    if (result.ok) setSession(result.data.actor.id)
    return result
  })
}

export async function signupHandler(req: Request) {
  if (supabaseConfigured()) return supabaseSignup(req)
  return withMutation(req, async () => {
    const body = await readJson(req)
    const password = typeof body.password === "string" ? body.password : ""
    if (password.length < 8) {
      return {
        ok: false as const,
        wrote: false as const,
        error: { code: "VALIDATION" as const, message: "Use a password of at least 8 characters." },
      }
    }
    const goal = Number(body.stampGoal)
    const result = signup(getSeed(), getDelta(), {
      name: text(body.name),
      email: text(body.email),
      password,
      businessName: text(body.businessName),
      industry: industryOf(body.industry),
      stampGoal: Number.isFinite(goal) ? goal : 8,
      rewardText: text(body.rewardText),
      primaryColor: text(body.primaryColor) || "#24312B",
      accentColor: text(body.accentColor) || "#C23B22",
      city: text(body.city),
      origin: originOf(req),
    })
    if (result.ok) setSession(result.data.actor.id)
    return result
  })
}

export async function logoutHandler(req: Request) {
  if (supabaseConfigured()) return supabaseLogout()
  return withMutation(req, async () => {
    clearSession()
    return { ok: true as const, wrote: false as const, data: { signedOut: true } }
  })
}

export async function sessionHandler() {
  const actor = await withRead(() => currentActor())
  return Response.json({ ok: true, data: { actor } }, { headers: { "Cache-Control": "no-store" } })
}

export async function lookupHandler(req: Request) {
  if (supabaseConfigured()) return supabaseMutate("lookup_card", req)
  return withMutation(req, async () => {
    const body = await readJson(req)
    return lookupCard(getSeed(), getDelta(), currentActor(), {
      contact: text(body.contact),
      name: text(body.name),
      origin: originOf(req),
    })
  })
}

export async function punchHandler(req: Request) {
  if (supabaseConfigured()) return supabaseMutate("punch_card", req)
  return withMutation(req, async () => {
    const body = await readJson(req)
    return punchCard(getSeed(), getDelta(), currentActor(), text(body.code), Boolean(body.confirm))
  })
}

export async function redeemHandler(req: Request) {
  if (supabaseConfigured()) return supabaseMutate("redeem_card", req)
  return withMutation(req, async () => {
    const body = await readJson(req)
    const audience = body.audience === "staff" ? "staff" : "public"
    return redeemCard(
      getSeed(),
      getDelta(),
      audience === "staff" ? currentActor() : null,
      text(body.code),
      Boolean(body.demo),
      audience,
    )
  })
}

export async function merchantCardHandler(_req: Request, code: string) {
  return withRead(async () => {
    const result = merchantCard(getSeed(), getDelta(), currentActor(), code)
    const status = result.ok ? 200 : result.error.code === "UNAUTHORIZED" ? 401 : 404
    const body = result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
  })
}

export async function publicCardHandler(code: string, demo: boolean) {
  return withRead(async () => {
    const result = publicCard(getSeed(), getDelta(), code, demo)
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 404, headers: { "Cache-Control": "no-store" } })
    }
    return Response.json({ ok: true, data: result.data }, { headers: { "Cache-Control": "no-store" } })
  })
}

export async function walletHandler(req: Request) {
  return withRead(async () => {
    const body = await readJson(req)
    const provider = body.provider === "google" ? "google" : "apple"
    const result = publicCard(getSeed(), getDelta(), text(body.code), false)
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 404 })
    }
    const pass = walletProvider(provider).createPass(result.data)
    return Response.json({
      ok: true,
      data: {
        ...pass,
        downloadPath: `/api/wallet/download?code=${encodeURIComponent(result.data.code)}&provider=${provider}`,
      },
    })
  })
}

export async function walletDownloadHandler(code: string, provider: WalletKind) {
  return withRead(async () => {
    const result = publicCard(getSeed(), getDelta(), code, false)
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 404 })
    }
    const file = walletProvider(provider).download(result.data)
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    })
  })
}

export async function programHandler(req: Request) {
  return withMutation(req, async () => {
    const body = await readJson(req)
    const goal = Number(body.stampGoal)
    return updateProgram(getSeed(), getDelta(), currentActor(), {
      name: text(body.name),
      rewardText: text(body.rewardText),
      stampGoal: Number.isFinite(goal) ? goal : undefined,
      primaryColor: text(body.primaryColor),
      accentColor: text(body.accentColor),
      city: text(body.city),
      tagline: text(body.tagline),
      logoUrl: typeof body.logoUrl === "string" ? body.logoUrl : undefined,
    })
  })
}

export async function teamHandler(req: Request) {
  return withMutation(req, async () => {
    const body = await readJson(req)
    const result = addStaff(getSeed(), getDelta(), currentActor(), {
      name: text(body.name),
      email: text(body.email),
      password: typeof body.password === "string" ? body.password : "",
    })
    if (result.ok) {
      await sendEmail({
        to: result.data.email,
        subject: "You're on the Stamply counter",
        text: "Your staff login was created.",
      })
    }
    return result
  })
}

export async function rewardCopyHandler(req: Request) {
  return withRead(async () => {
    const actor = currentActor()
    const view = dashboard(getSeed(), getDelta(), actor)
    if (!view.ok) {
      return Response.json({ ok: false, error: view.error }, { status: 401 })
    }
    const body = await readJson(req)
    const copy = await suggestRewardCopy({
      businessName: text(body.businessName) || view.data.tenant.name,
      industry: industryOf(body.industry || view.data.tenant.industry),
      goal: Number(body.stampGoal) || view.data.tenant.stampGoal,
      plan: view.data.tenant.plan,
    })
    return Response.json({ ok: true, data: copy })
  })
}

export async function checkoutHandler(req: Request) {
  return withRead(async () => {
    const actor = currentActor()
    const view = dashboard(getSeed(), getDelta(), actor)
    if (!view.ok || !actor) {
      return Response.json({ ok: false, error: view.ok ? { code: "UNAUTHORIZED", message: "Sign in." } : view.error }, { status: 401 })
    }
    const body = await readJson(req)
    const plan: PlanId = body.plan === "pro" ? "pro" : "starter"
    const checkout = await startCheckout({
      plan,
      tenantId: view.data.tenant.id,
      email: actor.email,
      origin: originOf(req),
    })
    return Response.json({ ok: true, data: checkout })
  })
}

export async function activateHandler(req: Request) {
  if (process.env.STRIPE_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Plan changes are applied by the Stripe webhook when billing is live.",
        },
      },
      { status: 403 },
    )
  }
  return withMutation(req, async () => {
    const body = await readJson(req)
    const plan: PlanId = body.plan === "pro" ? "pro" : "starter"
    return setPlan(getSeed(), getDelta(), currentActor(), plan)
  })
}

export async function webhookHandler(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ ok: true, mode: "mock" })
  }
  const Stripe = (await import("stripe")).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const signature = req.headers.get("stripe-signature")
  if (!signature) return Response.json({ ok: false }, { status: 400 })
  const payload = await req.text()
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object
      const plan = session.metadata?.plan === "pro" ? "pro" : "starter"
      const tenantId = session.metadata?.tenantId
      if (tenantId && supabaseConfigured()) {
        const admin = supabaseAdmin()
        if (admin) {
          await admin
            .from("tenants")
            .update({
              plan,
              stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
              stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
            })
            .eq("id", tenantId)
        }
      }
    }
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false, error: { code: "VALIDATION", message: "Invalid Stripe signature." } }, { status: 400 })
  }
}

export async function loadSession() {
  return withRead(() => currentActor())
}

export async function loadDashboard() {
  return withRead(() => {
    const actor = currentActor()
    const result = dashboard(getSeed(), getDelta(), actor)
    return { actor, result }
  })
}

export async function loadCards() {
  return withRead(() => {
    const actor = currentActor()
    return { actor, result: listCards(getSeed(), getDelta(), actor) }
  })
}

export async function loadActivity() {
  return withRead(() => {
    const actor = currentActor()
    return { actor, result: listActivity(getSeed(), getDelta(), actor) }
  })
}

export async function loadTeam() {
  return withRead(() => {
    const actor = currentActor()
    return { actor, result: listTeam(getSeed(), getDelta(), actor) }
  })
}

export async function loadAdmin() {
  return withRead(() => {
    const actor = currentActor()
    return { actor, result: adminOverview(getSeed(), getDelta(), actor) }
  })
}

export async function loadPublicCard(code: string, demo: boolean) {
  return withRead(() => publicCard(getSeed(), getDelta(), code, demo))
}

export function healthPayload() {
  return integrationStatus()
}
