import { connection } from "next/server"

import { healthPayload } from "@/lib/handlers"
import { walletStatus } from "@/lib/wallet"

export async function GET() {
  await connection()
  return Response.json(
    { ok: true, data: { ...healthPayload(), wallet: walletStatus() } },
    { headers: { "Cache-Control": "no-store" } },
  )
}
