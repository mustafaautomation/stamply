import { connection } from "next/server"
import { cookies } from "next/headers"
import { AsyncLocalStorage } from "node:async_hooks"

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  deltaCookiePairs,
  isSecureRequest,
  issueSession,
  parseCookieHeader,
  readDeltaFromMap,
  readSession,
  serializeCookie,
} from "@/lib/cookies"
import { actorById, getSeed } from "@/lib/loyalty"
import type { Actor, Db, Result } from "@/lib/types"

type SessionWrite = { kind: "set"; userId: string } | { kind: "clear" }

type Context = {
  delta: Db
  cookies: Map<string, string>
  dirty: boolean
  session: SessionWrite | null
  secure: boolean
}

const storage = new AsyncLocalStorage<Context>()

function mustContext() {
  const ctx = storage.getStore()
  if (!ctx) throw new Error("Stamply store was used outside a request.")
  return ctx
}

export function getDelta() {
  return mustContext().delta
}

export function currentActor(): Actor | null {
  const ctx = mustContext()
  const userId = readSession(ctx.cookies.get(SESSION_COOKIE))
  return actorById(getSeed(), ctx.delta, userId)
}

export function setSession(userId: string) {
  mustContext().session = { kind: "set", userId }
}

export function clearSession() {
  mustContext().session = { kind: "clear" }
}

export async function withRead<T>(fn: () => Promise<T> | T): Promise<T> {
  const existing = storage.getStore()
  if (existing) return await fn()
  await connection()
  const jar = await cookies()
  const map = new Map(jar.getAll().map((cookie) => [cookie.name, cookie.value]))
  const ctx: Context = {
    delta: readDeltaFromMap(map),
    cookies: map,
    dirty: false,
    session: null,
    secure: false,
  }
  return storage.run(ctx, async () => fn())
}

export async function withMutation<T>(req: Request, fn: () => Promise<Result<T>>): Promise<Response> {
  await connection()
  const map = parseCookieHeader(req.headers.get("cookie"))
  const ctx: Context = {
    delta: readDeltaFromMap(map),
    cookies: map,
    dirty: false,
    session: null,
    secure: isSecureRequest(req),
  }
  let result: Result<T>
  try {
    result = await storage.run(ctx, fn)
  } catch (error) {
    console.error(error)
    return jsonResponse(
      { ok: false, error: { code: "VALIDATION", message: "Something went wrong on the counter." } },
      500,
      [],
    )
  }
  if (result.ok && result.wrote) ctx.dirty = true
  const status = result.ok ? 200 : statusFor(result.error.code)
  const body = result.ok
    ? { ok: true, data: stripWrote(result.data) }
    : { ok: false, error: result.error }
  return jsonResponse(body, status, cookieHeaders(ctx))
}

function stripWrote(data: unknown) {
  if (!data || typeof data !== "object") return data
  if ("wrote" in data) {
    const clone = { ...(data as Record<string, unknown>) }
    delete clone.wrote
    return clone
  }
  return data
}

function cookieHeaders(ctx: Context) {
  const headers: string[] = []
  if (ctx.dirty) {
    for (const cookie of deltaCookiePairs(ctx.delta)) {
      headers.push(serializeCookie(cookie.name, cookie.value, { maxAge: cookie.maxAge, secure: ctx.secure }))
    }
  }
  if (ctx.session?.kind === "set") {
    headers.push(
      serializeCookie(SESSION_COOKIE, issueSession(ctx.session.userId), {
        maxAge: SESSION_MAX_AGE,
        secure: ctx.secure,
      }),
    )
  }
  if (ctx.session?.kind === "clear") {
    headers.push(serializeCookie(SESSION_COOKIE, "", { maxAge: 0, secure: ctx.secure }))
  }
  return headers
}

function jsonResponse(body: unknown, status: number, setCookies: string[]) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  })
  for (const cookie of setCookies) headers.append("Set-Cookie", cookie)
  return new Response(JSON.stringify(body), { status, headers })
}

function statusFor(code: string) {
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

export async function readJson(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}
