#!/usr/bin/env node
// Creates the showcase users in a hosted Supabase project.
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Apply supabase/migrations first. The script is a no-op guide when env is missing.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run again.")
  process.exit(1)
}

const { createClient } = await import("@supabase/supabase-js")
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const password = "stamply-demo"
const people = [
  ["admin@stamply.dev", "Mustafa", "super_admin", null],
  ["owner@lumencoffee.demo", "Mina Alvarez", "owner", "lumen-coffee"],
  ["staff@lumencoffee.demo", "Theo Park", "staff", "lumen-coffee"],
  ["owner@ateliernorth.demo", "Camille Roux", "owner", "atelier-north"],
  ["staff@ateliernorth.demo", "Jess Okonkwo", "staff", "atelier-north"],
  ["owner@ironandoak.demo", "Drew Hale", "owner", "iron-and-oak"],
  ["staff@ironandoak.demo", "Noor Shah", "staff", "iron-and-oak"],
]

for (const [email, name, role, slug] of people) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })
  if (error && !String(error.message).toLowerCase().includes("already")) {
    console.error(email, error.message)
    continue
  }
  const userId = data?.user?.id
  if (!userId) {
    console.log("exists", email)
    continue
  }
  await admin.from("profiles").upsert({ user_id: userId, full_name: name })
  if (role === "super_admin") {
    await admin.from("super_admins").upsert({ user_id: userId })
  } else if (slug) {
    const { data: tenant } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle()
    if (tenant?.id) {
      await admin.from("memberships").upsert(
        { user_id: userId, tenant_id: tenant.id, role: role === "owner" ? "owner" : "staff" },
        { onConflict: "user_id,tenant_id" },
      )
    } else {
      console.log("no tenant", slug, "— insert showcase rows before memberships")
    }
  }
  console.log("ready", email)
}

console.log("Showcase logins use the password stamply-demo. Card history still needs the SQL seed or the in-app mock data.")
