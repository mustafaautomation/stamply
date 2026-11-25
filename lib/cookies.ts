import { createHmac, timingSafeEqual } from "node:crypto"
import { deflateSync, inflateSync } from "node:zlib"

import { emptyDelta, type Db } from "@/lib/types"

const MONTH = 60 * 60 * 24 * 30
const CHUNK = 3200
const CHUNKS = 8

function secret() {
  return process.env.SESSION_SECRET || "stamply-mock-session-key"
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url")
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function issueSession(userId: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: now + 1000 * 60 * 60 * 24 * 14 }),
  ).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function readSession(token: string | undefined, now = Date.now()) {
  if (!token) return null
  const [payload, sig] = token.split(".")
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sub?: string
      exp?: number
    }
    if (!body.sub || typeof body.exp !== "number" || body.exp < now) return null
    return body.sub
  } catch {
    return null
  }
}

export function encodeDelta(delta: Db) {
  const b64 = deflateSync(Buffer.from(JSON.stringify(delta))).toString("base64url")
  return `${b64}.${sign(b64)}`
}

export function decodeDelta(raw: string | undefined): Db {
  if (!raw) return emptyDelta()
  const splitAt = raw.lastIndexOf(".")
  if (splitAt <= 0) return emptyDelta()
  const b64 = raw.slice(0, splitAt)
  const sig = raw.slice(splitAt + 1)
  if (!safeEqual(sig, sign(b64))) return emptyDelta()
  try {
    const parsed = JSON.parse(inflateSync(Buffer.from(b64, "base64url")).toString()) as Partial<Db>
    return {
      users: parsed.users ?? [],
      tenants: parsed.tenants ?? [],
      customers: parsed.customers ?? [],
      cards: parsed.cards ?? [],
      punches: parsed.punches ?? [],
      activity: parsed.activity ?? [],
      emails: parsed.emails ?? [],
    }
  } catch {
    return emptyDelta()
  }
}

export function deltaCookiePairs(delta: Db) {
  const encoded = encodeDelta(delta)
  const parts: string[] = []
  for (let index = 0; index < encoded.length; index += CHUNK) {
    parts.push(encoded.slice(index, index + CHUNK))
  }
  return Array.from({ length: CHUNKS }, (_, index) => ({
    name: `stamply_d${index}`,
    value: parts[index] ?? "",
    maxAge: parts[index] ? MONTH : 0,
  }))
}

export function readDeltaFromMap(map: Map<string, string>) {
  let joined = ""
  for (let index = 0; index < CHUNKS; index += 1) {
    const part = map.get(`stamply_d${index}`)
    if (!part) break
    joined += part
  }
  return decodeDelta(joined || undefined)
}

export function parseCookieHeader(header: string | null) {
  const map = new Map<string, string>()
  if (!header) return map
  for (const part of header.split(";")) {
    const idx = part.indexOf("=")
    if (idx === -1) continue
    const name = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    try {
      map.set(name, decodeURIComponent(value))
    } catch {
      map.set(name, value)
    }
  }
  return map
}

export function serializeCookie(
  name: string,
  value: string,
  opts: { maxAge: number; secure: boolean },
) {
  const bits = [`${name}=${value}`, "Path=/", `Max-Age=${opts.maxAge}`, "SameSite=Lax", "HttpOnly"]
  if (opts.secure) bits.push("Secure")
  return bits.join("; ")
}

export function isSecureRequest(req: Request) {
  if (process.env.COOKIE_SECURE === "true") return true
  if (process.env.COOKIE_SECURE === "false") return false
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  return proto === "https"
}

export const SESSION_COOKIE = "stamply_session"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14
