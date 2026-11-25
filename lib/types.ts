export type Industry = "cafe" | "salon" | "gym" | "other"
export type PlanId = "starter" | "pro"
export type Role = "super_admin" | "owner" | "staff"

export type User = {
  id: string
  email: string
  name: string
  passwordHash: string
  role: Role
  tenantId: string | null
  createdAt: string
}

export type Tenant = {
  id: string
  slug: string
  name: string
  industry: Industry
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  stampGoal: number
  rewardText: string
  plan: PlanId
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  readOnly: boolean
  city: string
  tagline: string
  createdAt: string
}

export type Customer = {
  id: string
  tenantId: string
  name: string
  email: string
  phone: string
  createdAt: string
}

export type Card = {
  id: string
  tenantId: string
  customerId: string
  code: string
  stamps: number
  rewardsRedeemed: number
  rewardUnlocked: boolean
  lastPunchAt: string | null
  createdAt: string
}

export type Punch = {
  id: string
  tenantId: string
  cardId: string
  staffId: string
  override: boolean
  createdAt: string
}

export type Activity = {
  id: string
  tenantId: string | null
  actorId: string | null
  action: string
  summary: string
  createdAt: string
}

export type OutboxEmail = {
  id: string
  to: string
  subject: string
  text: string
  createdAt: string
}

export type Db = {
  users: User[]
  tenants: Tenant[]
  customers: Customer[]
  cards: Card[]
  punches: Punch[]
  activity: Activity[]
  emails: OutboxEmail[]
}

export type Actor = {
  id: string
  email: string
  name: string
  role: Role
  tenantId: string | null
}

export type ApiError = {
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "COOLDOWN"
    | "READ_ONLY"
    | "VALIDATION"
    | "CONFLICT"
    | "FULL"
  message: string
  retryAfterSeconds?: number
  canCreate?: boolean
}

export type Result<T> =
  | { ok: true; wrote: boolean; data: T }
  | { ok: false; wrote: false; error: ApiError }

export type PublicCard = {
  code: string
  businessName: string
  industry: Industry
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  stampGoal: number
  stamps: number
  rewardText: string
  rewardUnlocked: boolean
  rewardsRedeemed: number
  customerFirstName: string
  customerName: string
  city: string
  tagline: string
  readOnly: boolean
  showcase: boolean
}

export type MerchantCard = PublicCard & {
  email: string
  phone: string
  lastPunchAt: string | null
}

export type TenantView = {
  id: string
  slug: string
  name: string
  industry: Industry
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  stampGoal: number
  rewardText: string
  plan: PlanId
  readOnly: boolean
  city: string
  tagline: string
}

export type RetentionPoint = { label: string; rate: number }

export type DashboardData = {
  tenant: TenantView
  activeCards: number
  punchesToday: number
  rewardsRedeemed: number
  retention: RetentionPoint[]
  activity: Activity[]
  staffCount: number
  cardLimit: number
  staffLimit: number
  priceMonthly: number
}

export type SignupInput = {
  name: string
  email: string
  password: string
  businessName: string
  industry: Industry
  stampGoal: number
  rewardText: string
  primaryColor: string
  accentColor: string
  city?: string
  origin: string
}

export const PLAN_LIMITS: Record<
  PlanId,
  { cards: number; staff: number; priceMonthly: number; ai: boolean }
> = {
  starter: { cards: 200, staff: 3, priceMonthly: 29, ai: false },
  pro: { cards: 5000, staff: 25, priceMonthly: 79, ai: true },
}

export const DEMO_PASSWORD = "stamply-demo"

export function emptyDelta(): Db {
  return {
    users: [],
    tenants: [],
    customers: [],
    cards: [],
    punches: [],
    activity: [],
    emails: [],
  }
}
