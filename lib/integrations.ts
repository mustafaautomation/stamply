import type { Industry, PlanId } from "@/lib/types"

export type RewardCopy = {
  source: "mock" | "groq" | "gemini" | "upgrade"
  suggestions: string[]
  message?: string
}

export async function suggestRewardCopy(input: {
  businessName: string
  industry: Industry
  goal: number
  plan: PlanId
}): Promise<RewardCopy> {
  const mock = mockLines(input)
  const live = Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY)
  if (live && input.plan !== "pro") {
    return {
      source: "upgrade",
      suggestions: mock.slice(0, 1),
      message: "Live reward copy is a Pro feature. Showing one studio line.",
    }
  }
  if (process.env.GROQ_API_KEY) {
    try {
      return { source: "groq", suggestions: await groqLines(input) }
    } catch {
      return { source: "mock", suggestions: mock, message: "Groq was unavailable. Showing studio lines." }
    }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      return { source: "gemini", suggestions: await geminiLines(input) }
    } catch {
      return { source: "mock", suggestions: mock, message: "Gemini was unavailable. Showing studio lines." }
    }
  }
  return { source: "mock", suggestions: mock }
}

function mockLines(input: { businessName: string; industry: Industry; goal: number }) {
  const place = input.businessName.trim() || "the shop"
  const goal = input.goal
  if (input.industry === "salon") {
    return [
      `Visit ${goal} and the gloss is on the house.`,
      `Every ${goal}th appointment, a treatment with our compliments.`,
      `${place} keeps your chair. Stamp ${goal} and we add the shine.`,
    ]
  }
  if (input.industry === "gym") {
    return [
      `${goal} sessions in, then bring someone you train with.`,
      `Show up ${goal} times. The next week is for a guest.`,
      `${place} counts the work. Stamp ${goal} and the door opens wider.`,
    ]
  }
  if (input.industry === "cafe") {
    return [
      `${goal} stamps, then a drink on the house.`,
      `Your regular mug, paid up after ${goal} visits.`,
      `${place} owes you one when the card fills.`,
    ]
  }
  return [
    `Come back ${goal} times. The next one is our thank-you.`,
    `${place} punches the card. Stamp ${goal} unlocks the reward.`,
    `A full card at ${place} means we pick up the tab.`,
  ]
}

async function groqLines(input: { businessName: string; industry: Industry; goal: number }) {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "Write three short loyalty reward lines for a local business. No hashtags. Return JSON {\"suggestions\":[string,string,string]}.",
        },
        {
          role: "user",
          content: `${input.businessName}, a ${input.industry}, stamp goal ${input.goal}.`,
        },
      ],
    }),
  })
  if (!response.ok) throw new Error("Groq request failed")
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  return parseSuggestions(payload.choices?.[0]?.message?.content ?? "")
}

async function geminiLines(input: { businessName: string; industry: Industry; goal: number }) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash"
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Return JSON {"suggestions":[string,string,string]} with three short loyalty reward lines for ${input.businessName}, a ${input.industry}, after ${input.goal} stamps.`,
              },
            ],
          },
        ],
      }),
    },
  )
  if (!response.ok) throw new Error("Gemini request failed")
  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  return parseSuggestions(payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
}

function parseSuggestions(text: string) {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("No JSON")
  const parsed = JSON.parse(text.slice(start, end + 1)) as { suggestions?: unknown }
  if (!Array.isArray(parsed.suggestions)) throw new Error("No suggestions")
  const lines = parsed.suggestions.filter((item): item is string => typeof item === "string").slice(0, 3)
  if (lines.length === 0) throw new Error("Empty suggestions")
  return lines
}

export async function sendEmail(email: { to: string; subject: string; text: string }) {
  if (!process.env.RESEND_API_KEY || !email.to) return { mode: "mock" as const }
  const from = process.env.EMAIL_FROM || "Stamply <cards@stamply.app>"
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text }),
  })
  if (!response.ok) {
    return { mode: "mock" as const, warning: "The email provider rejected the message. It is still in the outbox." }
  }
  return { mode: "live" as const }
}
