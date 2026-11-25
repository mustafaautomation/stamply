import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseAnonKey())
}

export function supabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
}

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ""
}

export function supabaseAnon() {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function supabaseServer() {
  const jar = await cookies()
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            jar.set(cookie.name, cookie.value, cookie.options)
          }
        } catch {
          // Server Components can read the session but cannot write cookies.
        }
      },
    },
  })
}

export type ServerSupabase = SupabaseClient
