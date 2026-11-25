import { connection } from "next/server"

import { merchantCardHandler } from "@/lib/handlers"

export async function GET(req: Request, context: { params: Promise<{ code: string }> }) {
  await connection()
  const { code } = await context.params
  return merchantCardHandler(req, code)
}
