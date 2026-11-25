import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url")
  const hash = scryptSync(password, salt, 32, SCRYPT).toString("base64url")
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split("$")
  if (algo !== "scrypt" || !salt || !hash) return false
  const actual = scryptSync(password, salt, 32, SCRYPT)
  const expected = Buffer.from(hash, "base64url")
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}
