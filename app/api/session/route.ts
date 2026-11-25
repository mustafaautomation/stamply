import { connection } from "next/server"

import { sessionHandler } from "@/lib/handlers"

export async function GET() {
  await connection()
  return sessionHandler()
}
