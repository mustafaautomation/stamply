import { connection } from "next/server"

import { walletDownloadHandler } from "@/lib/handlers"
import type { WalletKind } from "@/lib/wallet"

export async function GET(req: Request) {
  await connection()
  const url = new URL(req.url)
  const provider: WalletKind = url.searchParams.get("provider") === "google" ? "google" : "apple"
  return walletDownloadHandler(url.searchParams.get("code") ?? "", provider)
}
