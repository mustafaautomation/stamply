import assert from "node:assert/strict"
import test from "node:test"

import { hashPassword } from "../lib/password.ts"
import { emptyDelta } from "../lib/types.ts"
import {
  buildSeed,
  compactDelta,
  dashboard,
  login,
  lookupCard,
  merchantCard,
  publicCard,
  punchCard,
  redeemCard,
  retentionSeries,
  signup,
} from "../lib/loyalty.ts"
import { walletProvider } from "../lib/wallet.ts"
import { encodeDelta } from "../lib/cookies.ts"

const now = Date.parse("2026-11-25T15:00:00.000Z")

test("staff punches unlock a reward and the cooldown asks for confirmation", () => {
  const seed = buildSeed(now, hashPassword("stamply-demo"))
  const delta = emptyDelta()
  const created = signup(seed, delta, {
    name: "Avery Cole",
    email: "avery@e2e.stamply.test",
    password: "correct-horse-stamp",
    businessName: "Playwright Roasters",
    industry: "cafe",
    stampGoal: 3,
    rewardText: "Free espresso",
    primaryColor: "#24312B",
    accentColor: "#C23B22",
    origin: "http://127.0.0.1:43123",
  })
  assert.equal(created.ok, true)
  if (!created.ok) return
  const found = lookupCard(seed, delta, created.data.actor, {
    contact: "riley@e2e.stamply.test",
    name: "Riley Quinn",
    origin: "http://127.0.0.1:43123",
  }, now)
  assert.equal(found.ok, true)
  if (!found.ok) return
  const first = punchCard(seed, delta, created.data.actor, found.data.code, false, now)
  assert.equal(first.ok, true)
  if (!first.ok) return
  assert.equal(first.data.stamps, 1)
  const blocked = punchCard(seed, delta, created.data.actor, found.data.code, false, now + 1000)
  assert.equal(blocked.ok, false)
  if (blocked.ok) return
  assert.equal(blocked.error.code, "COOLDOWN")
  const second = punchCard(seed, delta, created.data.actor, found.data.code, true, now + 1000)
  const third = second.ok
    ? punchCard(seed, delta, created.data.actor, found.data.code, true, now + 2000)
    : second
  assert.equal(third.ok, true)
  if (!third.ok) return
  assert.equal(third.data.stamps, 3)
  assert.equal(third.data.rewardUnlocked, true)
})

test("showcase cards are read-only and tenants cannot see each other", () => {
  const seed = buildSeed(now, hashPassword("stamply-demo"))
  const delta = emptyDelta()
  const blocked = redeemCard(seed, delta, null, "LUMEN-MAYA", true, "public", now)
  assert.equal(blocked.ok, false)
  if (blocked.ok) return
  assert.equal(blocked.error.code, "READ_ONLY")
  const still = publicCard(seed, delta, "LUMEN-MAYA", true)
  assert.equal(still.ok, true)
  if (!still.ok) return
  assert.equal(still.data.stamps, 8)
  const salon = login(seed, delta, "owner@ateliernorth.demo", "stamply-demo")
  assert.equal(salon.ok, true)
  if (!salon.ok) return
  const hidden = merchantCard(seed, delta, salon.data.actor, "LUMEN-MAYA")
  assert.equal(hidden.ok, false)
  if (hidden.ok) return
  assert.equal(hidden.error.code, "NOT_FOUND")
  const cafe = login(seed, delta, "owner@lumencoffee.demo", "stamply-demo")
  assert.equal(cafe.ok, true)
  if (!cafe.ok) return
  const home = dashboard(seed, delta, cafe.data.actor, now)
  assert.equal(home.ok, true)
  if (!home.ok) return
  assert.ok(home.data.punchesToday >= 1)
  assert.ok(home.data.rewardsRedeemed >= 1)
  assert.equal(home.data.retention.length, 8)
  assert.ok(home.data.retention.some((point) => point.rate > 0))
  assert.equal(retentionSeries([], now).length, 8)
})

test("mock wallet returns a preview and a placeholder pass", () => {
  const seed = buildSeed(now, hashPassword("stamply-demo"))
  const card = publicCard(seed, emptyDelta(), "LUMEN-MAYA", false)
  assert.equal(card.ok, true)
  if (!card.ok) return
  const pass = walletProvider("apple").createPass(card.data)
  assert.equal(pass.mode, "mock")
  assert.match(pass.preview, /^data:image\/svg\+xml;base64,/)
  assert.match(pass.message, /Preview only/)
  const file = walletProvider("apple").download(card.data)
  assert.equal(file.bytes.subarray(0, 2).toString(), "PK")
  const google = walletProvider("google").createPass(card.data)
  assert.equal(google.provider, "google")
  assert.match(google.preview, /svg/)
})

test("a busy counter keeps the cookie delta inside the header budget", () => {
  const seed = buildSeed(now, hashPassword("stamply-demo"))
  const delta = emptyDelta()
  const created = signup(seed, delta, {
    name: "Avery Cole",
    email: "avery@e2e.stamply.test",
    password: "correct-horse-stamp",
    businessName: "Busy Roasters",
    industry: "cafe",
    stampGoal: 8,
    rewardText: "Free espresso",
    primaryColor: "#24312B",
    accentColor: "#C23B22",
    origin: "http://127.0.0.1:43123",
  })
  assert.equal(created.ok, true)
  if (!created.ok) return
  const actor = created.data.actor
  let at = now
  const codes: string[] = []
  for (let index = 0; index < 20; index += 1) {
    const card = lookupCard(seed, delta, actor, { contact: `guest${index}@e2e.stamply.test`, name: `Guest ${index}`, origin: "http://x" }, at)
    assert.equal(card.ok, true)
    if (!card.ok) return
    codes.push(card.data.code)
    for (let stamp = 0; stamp < 8; stamp += 1) {
      at += 60_000
      assert.equal(punchCard(seed, delta, actor, card.data.code, true, at).ok, true)
    }
    assert.equal(redeemCard(seed, delta, actor, card.data.code, false, "staff", at).ok, true)
  }
  const size = (db: typeof delta) => encodeDelta(db).length
  assert.ok(size(delta) > 10_000, "fixture should overflow the budget before compaction")
  const compacted = compactDelta(delta, size, 10_000, at)
  assert.ok(size(compacted) <= 10_000)
  assert.equal(compacted.tenants.length, 1)
  assert.equal(compacted.users.length, 1)
  assert.equal(compacted.cards.length, 20)
  for (const code of codes) assert.equal(merchantCard(seed, compacted, actor, code).ok, true)
  const home = dashboard(seed, compacted, actor, at)
  assert.equal(home.ok, true)
  if (!home.ok) return
  assert.equal(home.data.rewardsRedeemed, 20)
  assert.ok(home.data.punchesToday > 0)
})
