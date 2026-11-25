import { NextResponse } from "next/server"

import { supabaseAdmin, supabaseAnon, supabaseConfigured, supabaseServer } from "@/lib/supabase"

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function statusFor(code: string | undefined) {
  switch (code) {
    case "UNAUTHORIZED":
      return 401
    case "FORBIDDEN":
    case "READ_ONLY":
      return 403
    case "NOT_FOUND":
      return 404
    case "CONFLICT":
    case "COOLDOWN":
    case "FULL":
      return 409
    default:
      return 422
  }
}

async function actorForUser() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  const user = data.user
  const [{ data: admin }, { data: membership }, { data: profile }] = await Promise.all([
    supabase.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("memberships").select("tenant_id, role").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
  ])
  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name || user.email || "Member",
    role: admin ? "super_admin" : (membership?.role ?? "owner"),
    tenantId: membership?.tenant_id ?? null,
  }
}

export async function supabaseLogin(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithPassword({
    email: text(body.email),
    password: typeof body.password === "string" ? body.password : "",
  })
  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Email or password is wrong." } },
      { status: 401 },
    )
  }
  const actor = await actorForUser()
  return NextResponse.json({ ok: true, data: { actor } })
}

export async function supabaseSignup(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const password = typeof body.password === "string" ? body.password : ""
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION", message: "Use a password of at least 8 characters." } },
      { status: 422 },
    )
  }
  const supabase = await supabaseServer()
  const email = text(body.email)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: text(body.name) } },
  })
  if (error || !data.user) {
    return NextResponse.json(
      { ok: false, error: { code: "CONFLICT", message: error?.message || "Could not create the account." } },
      { status: 409 },
    )
  }
  if (!data.session) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Confirm the email, or disable email confirmation in Supabase, then sign in.",
        },
      },
      { status: 422 },
    )
  }
  const { data: created, error: rpcError } = await supabase.rpc("create_merchant_tenant", {
    p_name: text(body.businessName),
    p_industry: text(body.industry) || "cafe",
    p_goal: Number(body.stampGoal) || 8,
    p_reward: text(body.rewardText),
    p_primary: text(body.primaryColor) || "#24312B",
    p_accent: text(body.accentColor) || "#C23B22",
    p_city: text(body.city),
    p_full_name: text(body.name),
  })
  if (rpcError) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION", message: rpcError.message } },
      { status: 422 },
    )
  }
  return NextResponse.json(created)
}

export async function supabaseLogout() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true, data: { signedOut: true } })
}

export async function supabaseMutate(name: "lookup_card" | "punch_card" | "redeem_card", req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const supabase = await supabaseServer()
  const args =
    name === "punch_card"
      ? { p_code: text(body.code), p_confirm: Boolean(body.confirm) }
      : name === "redeem_card"
        ? {
            p_code: text(body.code),
            p_demo: Boolean(body.demo),
            p_audience: body.audience === "staff" ? "staff" : "public",
          }
        : {
            p_contact: text(body.contact),
            p_name: text(body.name),
            p_origin: new URL(req.url).origin,
          }
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION", message: error.message } },
      { status: 422 },
    )
  }
  const payload = data as { ok?: boolean; error?: { code?: string } }
  return NextResponse.json(data, { status: payload?.ok ? 200 : statusFor(payload?.error?.code) })
}

export async function supabasePublicCard(code: string, demo: boolean) {
  if (!supabaseConfigured()) return null
  const { data, error } = await supabaseAnon().rpc("get_public_card", { p_code: code, p_demo: demo })
  if (error) return { ok: false as const, error: { code: "VALIDATION" as const, message: error.message } }
  return data as { ok: boolean; data?: unknown; error?: { code: string; message: string } }
}

export function serviceRoleReady() {
  return Boolean(supabaseAdmin())
}
