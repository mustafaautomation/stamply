// Mock-mode loyalty engine. The seeded showcase is rebuilt in memory; everything a
// browser creates lives in a signed cookie "delta" that is merged over the seed.
// Rules mirror the Supabase functions in supabase/migrations (punch_card, redeem_card, lookup_card).
// Reconstructed 25 Nov 2026 from usage after the original file was lost in the Cursor rescue.

import { hashPassword, verifyPassword } from "@/lib/password"
import {
  DEMO_PASSWORD,
  PLAN_LIMITS,
  type Activity,
  type Actor,
  type ApiError,
  type Card,
  type Customer,
  type DashboardData,
  type Db,
  type Industry,
  type MerchantCard,
  type OutboxEmail,
  type PlanId,
  type PublicCard,
  type Punch,
  type Result,
  type RetentionPoint,
  type Role,
  type SignupInput,
  type Tenant,
  type TenantView,
  type User,
} from "@/lib/types"

const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY
const RETENTION_WEEKS = 8
const ACTIVE_WINDOW = 30 * DAY

const READ_ONLY_PROGRAM = "This showcase is read-only. Create your own program to stamp cards."
const READ_ONLY_CARD = "This showcase card is read-only. Stamps stay put."
const NOT_ON_ACCOUNT = "That card is not on this account."

type Failure = { ok: false; wrote: false; error: ApiError }

function fail(code: ApiError["code"], message: string, extra: Partial<ApiError> = {}): Failure {
  return { ok: false, wrote: false, error: { code, message, ...extra } }
}

function done<T>(data: T, wrote: boolean): Result<T> {
  return { ok: true, wrote, data }
}

function cooldownSeconds() {
  const raw = Number(process.env.PUNCH_COOLDOWN_SECONDS)
  return Number.isFinite(raw) && raw >= 0 ? raw : 90
}

function newId() {
  return globalThis.crypto.randomUUID()
}

function iso(ms: number) {
  return new Date(ms).toISOString()
}

function startOfUtcDay(ms: number) {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isHex(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function digits(value: string) {
  return value.replace(/\D/g, "")
}

function clampGoal(goal: number) {
  return Math.min(24, Math.max(2, Math.round(goal)))
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomCode(length: number) {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("")
}

// ---------------------------------------------------------------------------
// Seed + delta merge
// ---------------------------------------------------------------------------

function mergeList<T extends { id: string }>(seed: T[], delta: T[]): T[] {
  const overridden = new Set(delta.map((item) => item.id))
  return [...seed.filter((item) => !overridden.has(item.id)), ...delta]
}

function view(seed: Db, delta: Db): Db {
  return {
    users: mergeList(seed.users, delta.users),
    tenants: mergeList(seed.tenants, delta.tenants),
    customers: mergeList(seed.customers, delta.customers),
    cards: mergeList(seed.cards, delta.cards),
    punches: mergeList(seed.punches, delta.punches),
    activity: mergeList(seed.activity, delta.activity),
    emails: mergeList(seed.emails, delta.emails),
  }
}

function upsert<T extends { id: string }>(list: T[], item: T) {
  const index = list.findIndex((entry) => entry.id === item.id)
  if (index >= 0) list[index] = item
  else list.push(item)
}

function log(delta: Db, tenantId: string | null, actorId: string | null, action: string, summary: string, now: number) {
  const entry: Activity = { id: newId(), tenantId, actorId, action, summary, createdAt: iso(now) }
  delta.activity.push(entry)
  return entry
}

function outbox(delta: Db, to: string, subject: string, text: string, now: number) {
  const email: OutboxEmail = { id: newId(), to, subject, text, createdAt: iso(now) }
  delta.emails.push(email)
  return email
}

type SeedCustomer = {
  key: string
  name: string
  email: string
  phone: string
  stamps: number
  redeemed: number
  /** 0 means a visit earlier today. */
  lastDaysAgo: number
  every: number
}

type SeedShop = {
  key: string
  slug: string
  name: string
  industry: Industry
  logoUrl: string
  primaryColor: string
  accentColor: string
  stampGoal: number
  rewardText: string
  plan: PlanId
  city: string
  tagline: string
  owner: { email: string; name: string }
  staff: { email: string; name: string }
  customers: SeedCustomer[]
}

const SHOPS: SeedShop[] = [
  {
    key: "lumen",
    slug: "lumen-coffee",
    name: "Lumen Coffee",
    industry: "cafe",
    logoUrl: "/marks/lumen.svg",
    primaryColor: "#2A211C",
    accentColor: "#E25A3C",
    stampGoal: 8,
    rewardText: "Free drip flight for your regular mug",
    plan: "pro",
    city: "Portland",
    tagline: "Division Street.",
    owner: { email: "owner@lumencoffee.demo", name: "Mina Alvarez" },
    staff: { email: "staff@lumencoffee.demo", name: "Theo Park" },
    customers: [
      { key: "MAYA", name: "Maya Chen", email: "maya.chen@example.com", phone: "(503) 555-0141", stamps: 8, redeemed: 1, lastDaysAgo: 0, every: 4 },
      { key: "JONAH", name: "Jonah Reyes", email: "jonah.reyes@example.com", phone: "(503) 555-0172", stamps: 5, redeemed: 0, lastDaysAgo: 0, every: 6 },
      { key: "PRIYA", name: "Priya Nair", email: "priya.nair@example.com", phone: "(503) 555-0118", stamps: 3, redeemed: 2, lastDaysAgo: 1, every: 3 },
      { key: "SAM", name: "Sam Ortiz", email: "sam.ortiz@example.com", phone: "(503) 555-0190", stamps: 7, redeemed: 0, lastDaysAgo: 2, every: 5 },
      { key: "ELLE", name: "Elle Brooks", email: "elle.brooks@example.com", phone: "(503) 555-0133", stamps: 1, redeemed: 0, lastDaysAgo: 9, every: 7 },
      { key: "MARCUS", name: "Marcus Lee", email: "marcus.lee@example.com", phone: "(503) 555-0126", stamps: 2, redeemed: 1, lastDaysAgo: 0, every: 5 },
    ],
  },
  {
    key: "atelier",
    slug: "atelier-north",
    name: "Atelier North",
    industry: "salon",
    logoUrl: "/marks/atelier.svg",
    primaryColor: "#3A2430",
    accentColor: "#E4B3C2",
    stampGoal: 6,
    rewardText: "A gloss treatment on the sixth visit",
    plan: "starter",
    city: "Seattle",
    tagline: "Capitol Hill.",
    owner: { email: "owner@ateliernorth.demo", name: "Camille Roux" },
    staff: { email: "staff@ateliernorth.demo", name: "Jess Okonkwo" },
    customers: [
      { key: "NINA", name: "Nina Park", email: "nina.park@example.com", phone: "(206) 555-0164", stamps: 6, redeemed: 1, lastDaysAgo: 0, every: 10 },
      { key: "ROSA", name: "Rosa Lindqvist", email: "rosa.l@example.com", phone: "(206) 555-0147", stamps: 2, redeemed: 0, lastDaysAgo: 3, every: 14 },
      { key: "AMARA", name: "Amara Osei", email: "amara.osei@example.com", phone: "(206) 555-0182", stamps: 4, redeemed: 1, lastDaysAgo: 5, every: 9 },
      { key: "GRACE", name: "Grace Kim", email: "grace.kim@example.com", phone: "(206) 555-0119", stamps: 1, redeemed: 0, lastDaysAgo: 12, every: 21 },
    ],
  },
  {
    key: "iron",
    slug: "iron-and-oak",
    name: "Iron & Oak",
    industry: "gym",
    logoUrl: "/marks/iron.svg",
    primaryColor: "#1B2620",
    accentColor: "#E0B15A",
    stampGoal: 10,
    rewardText: "A free guest week for a friend",
    plan: "pro",
    city: "Austin",
    tagline: "East Cesar Chavez.",
    owner: { email: "owner@ironandoak.demo", name: "Drew Hale" },
    staff: { email: "staff@ironandoak.demo", name: "Noor Shah" },
    customers: [
      { key: "ANDRE", name: "Andre Walsh", email: "andre.walsh@example.com", phone: "(512) 555-0158", stamps: 9, redeemed: 0, lastDaysAgo: 0, every: 2 },
      { key: "TESSA", name: "Tessa Morgan", email: "tessa.morgan@example.com", phone: "(512) 555-0103", stamps: 6, redeemed: 1, lastDaysAgo: 1, every: 3 },
      { key: "KAI", name: "Kai Nakamura", email: "kai.n@example.com", phone: "(512) 555-0177", stamps: 3, redeemed: 0, lastDaysAgo: 4, every: 4 },
      { key: "LENA", name: "Lena Ford", email: "lena.ford@example.com", phone: "(512) 555-0129", stamps: 8, redeemed: 2, lastDaysAgo: 0, every: 2 },
      { key: "OMAR", name: "Omar Haddad", email: "omar.h@example.com", phone: "(512) 555-0185", stamps: 0, redeemed: 1, lastDaysAgo: 6, every: 3 },
    ],
  },
]

/** Builds the showcase deterministically from `now`. Ids are stable so sessions survive restarts. */
export function buildSeed(now: number, passwordHash: string): Db {
  const db: Db = {
    users: [],
    tenants: [],
    customers: [],
    cards: [],
    punches: [],
    activity: [],
    emails: [],
  }
  const dayStart = startOfUtcDay(now)
  const opened = iso(now - 120 * DAY)
  db.users.push({
    id: "seed-user-admin",
    email: "admin@stamply.dev",
    name: "Mustafa",
    passwordHash,
    role: "super_admin",
    tenantId: null,
    createdAt: opened,
  })
  let todaySlot = 0
  for (const shop of SHOPS) {
    const tenantId = `seed-tenant-${shop.key}`
    db.tenants.push({
      id: tenantId,
      slug: shop.slug,
      name: shop.name,
      industry: shop.industry,
      logoUrl: shop.logoUrl,
      primaryColor: shop.primaryColor,
      accentColor: shop.accentColor,
      stampGoal: shop.stampGoal,
      rewardText: shop.rewardText,
      plan: shop.plan,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      readOnly: true,
      city: shop.city,
      tagline: shop.tagline,
      createdAt: opened,
    })
    const ownerId = `seed-user-${shop.key}-owner`
    const staffId = `seed-user-${shop.key}-staff`
    db.users.push(
      { id: ownerId, email: shop.owner.email, name: shop.owner.name, passwordHash, role: "owner", tenantId, createdAt: opened },
      { id: staffId, email: shop.staff.email, name: shop.staff.name, passwordHash, role: "staff", tenantId, createdAt: opened },
    )
    for (const person of shop.customers) {
      const customerId = `seed-customer-${shop.key}-${person.key.toLowerCase()}`
      const cardId = `seed-card-${shop.key}-${person.key.toLowerCase()}`
      const code = `${shop.key.toUpperCase()}-${person.key}`
      const total = person.redeemed * shop.stampGoal + person.stamps
      let last: number
      if (person.lastDaysAgo === 0) {
        todaySlot += 1
        last = Math.max(dayStart, now - todaySlot * 23 * 60 * 1000)
      } else {
        last = dayStart - person.lastDaysAgo * DAY + 15 * 60 * 60 * 1000
      }
      const times: number[] = []
      for (let index = 0; index < total; index += 1) {
        times.unshift(last - index * person.every * DAY)
      }
      const first = times[0] ?? last - 2 * DAY
      db.customers.push({
        id: customerId,
        tenantId,
        name: person.name,
        email: person.email,
        phone: person.phone,
        createdAt: iso(first - 60 * 1000),
      })
      db.cards.push({
        id: cardId,
        tenantId,
        customerId,
        code,
        stamps: person.stamps,
        rewardsRedeemed: person.redeemed,
        rewardUnlocked: person.stamps >= shop.stampGoal,
        lastPunchAt: times.length ? iso(last) : null,
        createdAt: iso(first - 60 * 1000),
      })
      times.forEach((at, index) => {
        const staff = index % 3 === 0 ? ownerId : staffId
        db.punches.push({
          id: `${cardId}-p${index + 1}`,
          tenantId,
          cardId,
          staffId: staff,
          override: false,
          createdAt: iso(at),
        })
        db.activity.push({
          id: `${cardId}-a${index + 1}`,
          tenantId,
          actorId: staff,
          action: "card.punched",
          summary: `Stamped ${person.name}.`,
          createdAt: iso(at),
        })
        const position = index + 1
        if (position % shop.stampGoal === 0) {
          db.activity.push({
            id: `${cardId}-u${position}`,
            tenantId,
            actorId: staff,
            action: "reward.unlocked",
            summary: `${person.name} unlocked ${shop.rewardText}.`,
            createdAt: iso(at + 1000),
          })
          if (position / shop.stampGoal <= person.redeemed) {
            db.activity.push({
              id: `${cardId}-r${position}`,
              tenantId,
              actorId: staff,
              action: "reward.redeemed",
              summary: `Redeemed ${shop.rewardText} for ${person.name}.`,
              createdAt: iso(at + 2 * 60 * 1000),
            })
          }
        }
      })
    }
  }
  return db
}

const cache = globalThis as unknown as { __stamplySeed?: { day: number; db: Db } }

/** The in-memory showcase, rebuilt once per UTC day so "today" stays today. */
export function getSeed(): Db {
  const now = Date.now()
  const day = startOfUtcDay(now)
  if (!cache.__stamplySeed || cache.__stamplySeed.day !== day) {
    cache.__stamplySeed = { day, db: buildSeed(now, hashPassword(DEMO_PASSWORD)) }
  }
  return cache.__stamplySeed.db
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function toActor(user: User): Actor {
  return { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId }
}

export function actorById(seed: Db, delta: Db, userId: string | null): Actor | null {
  if (!userId) return null
  const user = view(seed, delta).users.find((item) => item.id === userId)
  return user ? toActor(user) : null
}

function tenantView(tenant: Tenant): TenantView {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    industry: tenant.industry,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor,
    accentColor: tenant.accentColor,
    stampGoal: tenant.stampGoal,
    rewardText: tenant.rewardText,
    plan: tenant.plan,
    readOnly: tenant.readOnly,
    city: tenant.city,
    tagline: tenant.tagline,
  }
}

function cardPayload(card: Card, tenant: Tenant, customer: Customer, demo: boolean): PublicCard {
  return {
    code: card.code,
    businessName: tenant.name,
    industry: tenant.industry,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor,
    accentColor: tenant.accentColor,
    stampGoal: tenant.stampGoal,
    stamps: card.stamps,
    rewardText: tenant.rewardText,
    rewardUnlocked: card.rewardUnlocked,
    rewardsRedeemed: card.rewardsRedeemed,
    customerFirstName: customer.name.split(" ")[0] ?? customer.name,
    customerName: customer.name,
    city: tenant.city,
    tagline: tenant.tagline,
    readOnly: demo || tenant.readOnly,
    showcase: tenant.readOnly,
  }
}

function merchantPayload(card: Card, tenant: Tenant, customer: Customer): MerchantCard {
  return {
    ...cardPayload(card, tenant, customer, false),
    email: customer.email,
    phone: customer.phone,
    lastPunchAt: card.lastPunchAt,
  }
}

function findCard(db: Db, code: string) {
  const wanted = code.trim().toLowerCase()
  if (!wanted) return null
  const card = db.cards.find((item) => item.code.toLowerCase() === wanted)
  if (!card) return null
  const tenant = db.tenants.find((item) => item.id === card.tenantId)
  const customer = db.customers.find((item) => item.id === card.customerId)
  if (!tenant || !customer) return null
  return { card, tenant, customer }
}

function isMember(actor: Actor | null, tenantId: string) {
  return Boolean(actor && actor.tenantId === tenantId && (actor.role === "owner" || actor.role === "staff"))
}

type Scoped = { error: Failure; tenant?: undefined } | { error?: undefined; tenant: Tenant }

function memberTenant(db: Db, actor: Actor | null): Scoped {
  if (!actor) return { error: fail("UNAUTHORIZED", "Sign in to open the counter.") }
  if (!actor.tenantId || (actor.role !== "owner" && actor.role !== "staff")) {
    return { error: fail("FORBIDDEN", "This login is not on a program.") }
  }
  const tenant = db.tenants.find((item) => item.id === actor.tenantId)
  if (!tenant) return { error: fail("NOT_FOUND", "That program is not in this browser any more.") }
  return { tenant }
}

export function formatDay(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
}

/** Share of cards stamped each week that had been stamped in an earlier week. Eight points, 0-100. */
export function retentionSeries(punches: Punch[], now: number = Date.now()): RetentionPoint[] {
  const firstSeen = new Map<string, number>()
  for (const punch of punches) {
    const at = Date.parse(punch.createdAt)
    const known = firstSeen.get(punch.cardId)
    if (known === undefined || at < known) firstSeen.set(punch.cardId, at)
  }
  const end = startOfUtcDay(now) + DAY
  const points: RetentionPoint[] = []
  for (let index = RETENTION_WEEKS - 1; index >= 0; index -= 1) {
    const start = end - (index + 1) * WEEK
    const stop = end - index * WEEK
    const active = new Set<string>()
    for (const punch of punches) {
      const at = Date.parse(punch.createdAt)
      if (at >= start && at < stop) active.add(punch.cardId)
    }
    let returning = 0
    for (const cardId of active) {
      if ((firstSeen.get(cardId) ?? start) < start) returning += 1
    }
    points.push({
      label: new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      rate: active.size ? Math.round((returning / active.size) * 100) : 0,
    })
  }
  return points
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function login(seed: Db, delta: Db, email: string, password: string): Result<{ actor: Actor }> {
  const wanted = email.trim().toLowerCase()
  const user = view(seed, delta).users.find((item) => item.email.toLowerCase() === wanted)
  if (!user || !password || !verifyPassword(password, user.passwordHash)) {
    return fail("UNAUTHORIZED", "Email or password is wrong.")
  }
  return done({ actor: toActor(user) }, false)
}

export function signup(
  seed: Db,
  delta: Db,
  input: SignupInput,
  now: number = Date.now(),
): Result<{ actor: Actor; tenant: TenantView }> {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const businessName = input.businessName.trim()
  const rewardText = input.rewardText.trim()
  if (!name) return fail("VALIDATION", "Add your name.")
  if (!isEmail(email)) return fail("VALIDATION", "Use a valid work email.")
  if (input.password.length < 8) return fail("VALIDATION", "Use a password of at least 8 characters.")
  if (!businessName) return fail("VALIDATION", "Add the business name.")
  if (!rewardText) return fail("VALIDATION", "Say what the reward is.")
  const db = view(seed, delta)
  if (db.users.some((user) => user.email.toLowerCase() === email)) {
    return fail("CONFLICT", "That email already has a login. Sign in instead.")
  }
  const base = slugify(businessName) || "program"
  let slug = base
  for (let index = 2; db.tenants.some((tenant) => tenant.slug === slug); index += 1) slug = `${base}-${index}`
  const tenant: Tenant = {
    id: newId(),
    slug,
    name: businessName,
    industry: input.industry,
    logoUrl: null,
    primaryColor: isHex(input.primaryColor) ? input.primaryColor : "#24312B",
    accentColor: isHex(input.accentColor) ? input.accentColor : "#C23B22",
    stampGoal: clampGoal(Number.isFinite(input.stampGoal) ? input.stampGoal : 8),
    rewardText,
    plan: "starter",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    readOnly: false,
    city: input.city?.trim() ?? "",
    tagline: "",
    createdAt: iso(now),
  }
  const user: User = {
    id: newId(),
    email,
    name,
    passwordHash: hashPassword(input.password),
    role: "owner",
    tenantId: tenant.id,
    createdAt: iso(now),
  }
  delta.tenants.push(tenant)
  delta.users.push(user)
  log(delta, tenant.id, user.id, "program.created", `${name} opened ${businessName}.`, now)
  outbox(
    delta,
    email,
    `${businessName} is on Stamply`,
    `Your punch card is live. Open the counter at ${input.origin}/dashboard.`,
    now,
  )
  return done({ actor: toActor(user), tenant: tenantView(tenant) }, true)
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export function publicCard(seed: Db, delta: Db, code: string, demo: boolean): Result<PublicCard> {
  const found = findCard(view(seed, delta), code)
  if (!found) return fail("NOT_FOUND", "No card uses that code.")
  return done(cardPayload(found.card, found.tenant, found.customer, demo), false)
}

export function merchantCard(seed: Db, delta: Db, actor: Actor | null, code: string): Result<MerchantCard> {
  if (!actor) return fail("UNAUTHORIZED", "Staff sign-in is required to pull up a card.")
  const found = findCard(view(seed, delta), code)
  if (!found || !isMember(actor, found.card.tenantId)) return fail("NOT_FOUND", NOT_ON_ACCOUNT)
  return done(merchantPayload(found.card, found.tenant, found.customer), false)
}

export function lookupCard(
  seed: Db,
  delta: Db,
  actor: Actor | null,
  input: { contact: string; name: string; origin: string },
  now: number = Date.now(),
): Result<MerchantCard> {
  if (!actor || !actor.tenantId || (actor.role !== "owner" && actor.role !== "staff")) {
    return fail("UNAUTHORIZED", "Staff sign-in is required to pull up a card.")
  }
  const db = view(seed, delta)
  const tenant = db.tenants.find((item) => item.id === actor.tenantId)
  if (!tenant) return fail("UNAUTHORIZED", "Staff sign-in is required to pull up a card.")
  const contact = input.contact.trim()
  if (!contact) return fail("VALIDATION", "Type a phone number, email, or card code.")
  const lower = contact.toLowerCase()
  const phone = digits(contact)
  const customers = new Map(db.customers.map((customer) => [customer.id, customer]))
  const existing = db.cards.find((card) => {
    if (card.tenantId !== tenant.id) return false
    if (card.code.toLowerCase() === lower) return true
    const customer = customers.get(card.customerId)
    if (!customer) return false
    if (contact.includes("@") && customer.email.toLowerCase() === lower) return true
    return phone.length >= 7 && digits(customer.phone) === phone
  })
  if (existing) {
    const customer = customers.get(existing.customerId)
    if (customer) return done(merchantPayload(existing, tenant, customer), false)
  }
  const name = input.name.trim()
  if (!name) {
    return fail("NOT_FOUND", "No card yet. Add the customer's name to start one.", { canCreate: true })
  }
  if (tenant.readOnly) return fail("READ_ONLY", READ_ONLY_PROGRAM)
  const limit = PLAN_LIMITS[tenant.plan].cards
  if (db.cards.filter((card) => card.tenantId === tenant.id).length >= limit) {
    return fail("FULL", `The ${tenant.plan} plan holds ${limit} cards. Upgrade to start more.`)
  }
  const email = contact.includes("@") ? lower : ""
  if (email && !isEmail(email)) return fail("VALIDATION", "That email does not look right.")
  const customer: Customer = {
    id: newId(),
    tenantId: tenant.id,
    name,
    email,
    phone: email ? "" : contact,
    createdAt: iso(now),
  }
  const prefix = (tenant.slug.split("-")[0] || "CARD").toUpperCase().slice(0, 10)
  let code = `${prefix}-${randomCode(6)}`
  while (db.cards.some((card) => card.code.toLowerCase() === code.toLowerCase())) code = `${prefix}-${randomCode(6)}`
  const card: Card = {
    id: newId(),
    tenantId: tenant.id,
    customerId: customer.id,
    code,
    stamps: 0,
    rewardsRedeemed: 0,
    rewardUnlocked: false,
    lastPunchAt: null,
    createdAt: iso(now),
  }
  delta.customers.push(customer)
  delta.cards.push(card)
  log(delta, tenant.id, actor.id, "card.created", `Started a card for ${name}.`, now)
  if (email) {
    outbox(delta, email, `Your ${tenant.name} card`, `Track your stamps at ${input.origin}/c/${code}.`, now)
  }
  return done(merchantPayload(card, tenant, customer), true)
}

export function punchCard(
  seed: Db,
  delta: Db,
  actor: Actor | null,
  code: string,
  confirm: boolean,
  now: number = Date.now(),
): Result<MerchantCard> {
  if (!actor) return fail("UNAUTHORIZED", "Staff sign-in is required to punch a card.")
  const found = findCard(view(seed, delta), code)
  if (!found || !isMember(actor, found.card.tenantId)) return fail("NOT_FOUND", NOT_ON_ACCOUNT)
  const { tenant, customer } = found
  if (tenant.readOnly) return fail("READ_ONLY", READ_ONLY_PROGRAM)
  if (found.card.rewardUnlocked || found.card.stamps >= tenant.stampGoal) {
    return fail("FULL", "This card is full. Redeem the reward before the next stamp.")
  }
  const windowMs = cooldownSeconds() * 1000
  let elapsed: number | null = null
  if (found.card.lastPunchAt) {
    elapsed = now - Date.parse(found.card.lastPunchAt)
    if (elapsed >= 0 && elapsed < windowMs && !confirm) {
      return fail("COOLDOWN", "This card was punched recently. Confirm to stamp again.", {
        retryAfterSeconds: Math.ceil((windowMs - elapsed) / 1000),
      })
    }
  }
  const stamps = found.card.stamps + 1
  const card: Card = {
    ...found.card,
    stamps,
    lastPunchAt: iso(now),
    rewardUnlocked: stamps >= tenant.stampGoal,
  }
  upsert(delta.cards, card)
  delta.punches.push({
    id: newId(),
    tenantId: tenant.id,
    cardId: card.id,
    staffId: actor.id,
    override: elapsed !== null && elapsed < windowMs,
    createdAt: iso(now),
  })
  log(delta, tenant.id, actor.id, "card.punched", `Stamped ${customer.name}.`, now)
  if (card.rewardUnlocked) {
    log(delta, tenant.id, actor.id, "reward.unlocked", `${customer.name} unlocked ${tenant.rewardText}.`, now)
  }
  return done(merchantPayload(card, tenant, customer), true)
}

export function redeemCard(
  seed: Db,
  delta: Db,
  actor: Actor | null,
  code: string,
  demo: boolean,
  audience: "staff" | "public",
  now: number = Date.now(),
): Result<PublicCard> {
  const found = findCard(view(seed, delta), code)
  if (!found) return fail("NOT_FOUND", "No card uses that code.")
  const { tenant, customer } = found
  if (audience === "staff") {
    if (!actor) return fail("UNAUTHORIZED", "Staff sign-in is required to redeem.")
    if (!isMember(actor, found.card.tenantId)) return fail("NOT_FOUND", NOT_ON_ACCOUNT)
  }
  if (demo || tenant.readOnly) return fail("READ_ONLY", READ_ONLY_CARD)
  if (!found.card.rewardUnlocked) return fail("VALIDATION", "The reward is not unlocked yet.")
  const card: Card = {
    ...found.card,
    stamps: 0,
    rewardUnlocked: false,
    rewardsRedeemed: found.card.rewardsRedeemed + 1,
    lastPunchAt: iso(now),
  }
  upsert(delta.cards, card)
  log(delta, tenant.id, actor?.id ?? null, "reward.redeemed", `Redeemed ${tenant.rewardText} for ${customer.name}.`, now)
  return done(cardPayload(card, tenant, customer, false), true)
}

export function listCards(seed: Db, delta: Db, actor: Actor | null): Result<MerchantCard[]> {
  const db = view(seed, delta)
  const scoped = memberTenant(db, actor)
  if (scoped.error) return scoped.error
  const tenant = scoped.tenant
  const customers = new Map(db.customers.map((customer) => [customer.id, customer]))
  const cards = db.cards
    .filter((card) => card.tenantId === tenant.id)
    .sort((a, b) => (b.lastPunchAt ?? b.createdAt).localeCompare(a.lastPunchAt ?? a.createdAt))
    .flatMap((card) => {
      const customer = customers.get(card.customerId)
      return customer ? [merchantPayload(card, tenant, customer)] : []
    })
  return done(cards, false)
}

export function listActivity(seed: Db, delta: Db, actor: Actor | null): Result<Activity[]> {
  const db = view(seed, delta)
  const scoped = memberTenant(db, actor)
  if (scoped.error) return scoped.error
  const items = db.activity
    .filter((item) => item.tenantId === scoped.tenant.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100)
  return done(items, false)
}

// ---------------------------------------------------------------------------
// Merchant
// ---------------------------------------------------------------------------

export function dashboard(seed: Db, delta: Db, actor: Actor | null, now: number = Date.now()): Result<DashboardData> {
  const db = view(seed, delta)
  const scoped = memberTenant(db, actor)
  if (scoped.error) return scoped.error
  const tenant = scoped.tenant
  const cards = db.cards.filter((card) => card.tenantId === tenant.id)
  const punches = db.punches.filter((punch) => punch.tenantId === tenant.id)
  const dayStart = startOfUtcDay(now)
  const limits = PLAN_LIMITS[tenant.plan]
  return done(
    {
      tenant: tenantView(tenant),
      activeCards: cards.filter((card) => now - Date.parse(card.lastPunchAt ?? card.createdAt) <= ACTIVE_WINDOW).length,
      punchesToday: punches.filter((punch) => {
        const at = Date.parse(punch.createdAt)
        return at >= dayStart && at < dayStart + DAY
      }).length,
      rewardsRedeemed: cards.reduce((sum, card) => sum + card.rewardsRedeemed, 0),
      retention: retentionSeries(punches, now),
      activity: db.activity
        .filter((item) => item.tenantId === tenant.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8),
      staffCount: db.users.filter((user) => user.tenantId === tenant.id).length,
      cardLimit: limits.cards,
      staffLimit: limits.staff,
      priceMonthly: limits.priceMonthly,
    },
    false,
  )
}

export function listTeam(
  seed: Db,
  delta: Db,
  actor: Actor | null,
): Result<{ id: string; name: string; email: string; role: Role }[]> {
  const db = view(seed, delta)
  const scoped = memberTenant(db, actor)
  if (scoped.error) return scoped.error
  const people = db.users
    .filter((user) => user.tenantId === scoped.tenant.id)
    .sort((a, b) => (a.role === b.role ? a.createdAt.localeCompare(b.createdAt) : a.role === "owner" ? -1 : 1))
    .map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role }))
  return done(people, false)
}

export function addStaff(
  seed: Db,
  delta: Db,
  actor: Actor | null,
  input: { name: string; email: string; password: string },
  now: number = Date.now(),
): Result<{ id: string; name: string; email: string; role: Role }> {
  const db = view(seed, delta)
  const scoped = memberTenant(db, actor)
  if (scoped.error) return scoped.error
  const tenant = scoped.tenant
  if (actor?.role !== "owner") return fail("FORBIDDEN", "Only the owner can add staff.")
  if (tenant.readOnly) return fail("READ_ONLY", READ_ONLY_PROGRAM)
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  if (!name) return fail("VALIDATION", "Add the staff member's name.")
  if (!isEmail(email)) return fail("VALIDATION", "Use a valid email for the staff login.")
  if (input.password.length < 8) return fail("VALIDATION", "Use a password of at least 8 characters.")
  if (db.users.some((user) => user.email.toLowerCase() === email)) {
    return fail("CONFLICT", "That email already has a login.")
  }
  const limit = PLAN_LIMITS[tenant.plan].staff
  if (db.users.filter((user) => user.tenantId === tenant.id).length >= limit) {
    return fail("FULL", `The ${tenant.plan} plan has room for ${limit} people. Upgrade to add more.`)
  }
  const user: User = {
    id: newId(),
    email,
    name,
    passwordHash: hashPassword(input.password),
    role: "staff",
    tenantId: tenant.id,
    createdAt: iso(now),
  }
  delta.users.push(user)
  log(delta, tenant.id, actor.id, "staff.added", `Added ${name} to the counter.`, now)
  outbox(delta, email, "You're on the Stamply counter", `${tenant.name} added you as staff. Sign in with ${email}.`, now)
  return done({ id: user.id, name: user.name, email: user.email, role: user.role }, true)
}

export function updateProgram(
  seed: Db,
  delta: Db,
  actor: Actor | null,
  input: {
    name: string
    rewardText: string
    stampGoal?: number
    primaryColor: string
    accentColor: string
    city: string
    tagline: string
    logoUrl?: string
  },
  now: number = Date.now(),
): Result<TenantView> {
  const db = view(seed, delta)
  const scoped = memberTenant(db, actor)
  if (scoped.error) return scoped.error
  const tenant = scoped.tenant
  if (actor?.role !== "owner") return fail("FORBIDDEN", "Only the owner can change the program.")
  if (tenant.readOnly) return fail("READ_ONLY", READ_ONLY_PROGRAM)
  if (input.primaryColor && !isHex(input.primaryColor)) return fail("VALIDATION", "Use a hex color like #24312B.")
  if (input.accentColor && !isHex(input.accentColor)) return fail("VALIDATION", "Use a hex color like #C23B22.")
  let logoUrl = tenant.logoUrl
  if (input.logoUrl !== undefined) {
    const logo = input.logoUrl.trim()
    if (logo && !/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(logo) && !logo.startsWith("/")) {
      return fail("VALIDATION", "Upload a PNG, JPG, WebP, or SVG logo.")
    }
    // The browser-only program lives in a cookie, so the logo has to stay small.
    if (logo.length > 12_000) return fail("VALIDATION", "Logo is too large for this preview. Use an image under 8KB.")
    logoUrl = logo || null
  }
  const next: Tenant = {
    ...tenant,
    name: input.name.trim() || tenant.name,
    rewardText: input.rewardText.trim() || tenant.rewardText,
    stampGoal: input.stampGoal !== undefined ? clampGoal(input.stampGoal) : tenant.stampGoal,
    primaryColor: input.primaryColor || tenant.primaryColor,
    accentColor: input.accentColor || tenant.accentColor,
    city: input.city,
    tagline: input.tagline,
    logoUrl,
  }
  upsert(delta.tenants, next)
  log(delta, tenant.id, actor.id, "program.updated", `Updated the ${next.name} card.`, now)
  return done(tenantView(next), true)
}

export function setPlan(
  seed: Db,
  delta: Db,
  actor: Actor | null,
  plan: PlanId,
  now: number = Date.now(),
): Result<{ plan: PlanId }> {
  const db = view(seed, delta)
  const scoped = memberTenant(db, actor)
  if (scoped.error) return scoped.error
  const tenant = scoped.tenant
  if (actor?.role !== "owner") return fail("FORBIDDEN", "Only the owner can change the plan.")
  if (tenant.readOnly) return fail("READ_ONLY", "Showcase billing is read-only.")
  upsert(delta.tenants, { ...tenant, plan })
  log(delta, tenant.id, actor.id, "billing.plan", `Switched to the ${plan} plan (mock billing).`, now)
  return done({ plan }, true)
}

// ---------------------------------------------------------------------------
// Super admin
// ---------------------------------------------------------------------------

export type AdminOverview = {
  totals: { tenants: number; cards: number; punchesToday: number; rewardsRedeemed: number }
  tenants: (TenantView & {
    cards: number
    punchesToday: number
    rewardsRedeemed: number
    owners: { name: string; email: string }[]
  })[]
  emails: OutboxEmail[]
}

export function adminOverview(seed: Db, delta: Db, actor: Actor | null, now: number = Date.now()): Result<AdminOverview> {
  if (!actor) return fail("UNAUTHORIZED", "Sign in as a super admin.")
  if (actor.role !== "super_admin") return fail("FORBIDDEN", "Only the platform admin can see every tenant.")
  const db = view(seed, delta)
  const dayStart = startOfUtcDay(now)
  const tenants = db.tenants.map((tenant) => {
    const cards = db.cards.filter((card) => card.tenantId === tenant.id)
    return {
      ...tenantView(tenant),
      cards: cards.length,
      punchesToday: db.punches.filter((punch) => {
        const at = Date.parse(punch.createdAt)
        return punch.tenantId === tenant.id && at >= dayStart && at < dayStart + DAY
      }).length,
      rewardsRedeemed: cards.reduce((sum, card) => sum + card.rewardsRedeemed, 0),
      owners: db.users
        .filter((user) => user.tenantId === tenant.id && user.role === "owner")
        .map((user) => ({ name: user.name, email: user.email })),
    }
  })
  return done(
    {
      totals: {
        tenants: tenants.length,
        cards: tenants.reduce((sum, tenant) => sum + tenant.cards, 0),
        punchesToday: tenants.reduce((sum, tenant) => sum + tenant.punchesToday, 0),
        rewardsRedeemed: tenants.reduce((sum, tenant) => sum + tenant.rewardsRedeemed, 0),
      },
      tenants,
      emails: [...db.emails].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 25),
    },
    false,
  )
}
