import { prefersLightText } from "@/lib/color"
import { crc32 } from "@/lib/zip"
import type { PublicCard } from "@/lib/types"

export type WalletKind = "apple" | "google"

export type WalletPassRequest = {
  card: PublicCard
  provider: WalletKind
}

export type WalletPassResult = {
  mode: "mock" | "live"
  provider: WalletKind
  preview: string
  filename: string
  contentType: string
  message: string
  configured: boolean
}

export interface WalletProvider {
  id: WalletKind
  label: string
  configured(): boolean
  createPass(card: PublicCard): WalletPassResult
  download(card: PublicCard): { filename: string; contentType: string; bytes: Buffer }
}

function appleConfigured() {
  return Boolean(
    process.env.APPLE_PASS_CERT_PEM &&
      process.env.APPLE_PASS_KEY_PEM &&
      process.env.APPLE_PASS_TYPE_ID &&
      process.env.APPLE_TEAM_ID,
  )
}

function googleConfigured() {
  return Boolean(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON)
}

const appleProvider: WalletProvider = {
  id: "apple",
  label: "Apple Wallet",
  configured: appleConfigured,
  createPass(card) {
    const configured = appleConfigured()
    return {
      mode: "mock",
      provider: "apple",
      preview: svgDataUrl(renderPassSvg(card, "apple")),
      filename: `${card.code}.pkpass`,
      contentType: "application/vnd.apple.pkpass",
      configured,
      message: configured
        ? "Certificates are present, but this build still downloads an unsigned placeholder. WalletProvider is the seam for a real signer."
        : "Preview only. Apple Wallet will not install this placeholder until pass certificates are configured.",
    }
  },
  download(card) {
    const pass = {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || "pass.com.stamply.placeholder",
      teamIdentifier: process.env.APPLE_TEAM_ID || "MOCK",
      organizationName: card.businessName,
      description: `${card.businessName} loyalty card`,
      serialNumber: card.code,
      backgroundColor: card.primaryColor,
      foregroundColor: prefersLightText(card.primaryColor) ? "#F6F1E8" : "#1C1410",
      labelColor: card.accentColor,
      storeCard: {
        headerFields: [{ key: "shop", label: "SHOP", value: card.businessName }],
        primaryFields: [
          { key: "stamps", label: "STAMPS", value: `${card.stamps} of ${card.stampGoal}` },
        ],
        secondaryFields: [{ key: "reward", label: "REWARD", value: card.rewardText }],
        auxiliaryFields: [{ key: "guest", label: "GUEST", value: card.customerFirstName }],
      },
      barcode: {
        format: "PKBarcodeFormatQR",
        message: card.code,
        messageEncoding: "iso-8859-1",
      },
      note: "Stamply placeholder pass. Not signed. Do not treat this as a payment instrument.",
    }
    const note = [
      "Stamply placeholder Apple Wallet pass.",
      "This file is not cryptographically signed.",
      "Add APPLE_PASS_CERT_PEM, APPLE_PASS_KEY_PEM, APPLE_PASS_TYPE_ID, and APPLE_TEAM_ID to switch WalletProvider out of mock mode.",
      "This is a loyalty punch card, not a crypto or payments wallet.",
    ].join("\n")
    const bytes = zipStore([
      { name: "pass.json", data: Buffer.from(JSON.stringify(pass, null, 2)) },
      { name: "README.txt", data: Buffer.from(note) },
    ])
    return {
      filename: `${card.code}.pkpass`,
      contentType: "application/vnd.apple.pkpass",
      bytes,
    }
  },
}

const googleProvider: WalletProvider = {
  id: "google",
  label: "Google Wallet",
  configured: googleConfigured,
  createPass(card) {
    const configured = googleConfigured()
    return {
      mode: "mock",
      provider: "google",
      preview: svgDataUrl(renderPassSvg(card, "google")),
      filename: `${card.code}.google-wallet.json`,
      contentType: "application/json",
      configured,
      message: configured
        ? "Google Wallet issuer credentials are present. This build still returns an unsigned placeholder save payload."
        : "Preview only. Google Wallet will not save this placeholder until an issuer account is configured.",
    }
  },
  download(card) {
    const payload = {
      kind: "stamply.googleWallet.placeholder",
      iss: process.env.GOOGLE_WALLET_ISSUER_ID || "mock-issuer",
      typ: "savetowallet",
      payload: {
        loyaltyObjects: [
          {
            id: `${process.env.GOOGLE_WALLET_ISSUER_ID || "mock"}.${card.code}`,
            classId: `${process.env.GOOGLE_WALLET_ISSUER_ID || "mock"}.${card.businessName}`,
            state: "ACTIVE",
            accountName: card.customerFirstName,
            accountId: card.code,
            loyaltyPoints: {
              label: "Stamps",
              balance: { string: `${card.stamps}/${card.stampGoal}` },
            },
            textModulesData: [{ header: "Reward", body: card.rewardText }],
          },
        ],
      },
      note: "Unsigned placeholder. Not a Google Wallet JWT.",
    }
    return {
      filename: `${card.code}.google-wallet.json`,
      contentType: "application/json",
      bytes: Buffer.from(JSON.stringify(payload, null, 2)),
    }
  },
}

export function walletProvider(kind: WalletKind): WalletProvider {
  return kind === "google" ? googleProvider : appleProvider
}

export function walletStatus() {
  return {
    apple: appleConfigured() ? "configured" : "mock",
    google: googleConfigured() ? "configured" : "mock",
    mode: appleConfigured() || googleConfigured() ? "keys-detected" : "mock",
  }
}

export function renderPassSvg(card: PublicCard, provider: WalletKind) {
  const light = prefersLightText(card.primaryColor)
  const ink = light ? "#F6F1E8" : "#1C1410"
  const muted = light ? "rgba(246,241,232,0.72)" : "rgba(28,20,16,0.62)"
  const dots = Array.from({ length: card.stampGoal }, (_, index) => {
    const filled = index < card.stamps
    const x = 36 + (index % 6) * 46
    const y = 214 + Math.floor(index / 6) * 42
    return `<circle cx="${x}" cy="${y}" r="14" fill="${filled ? card.accentColor : "none"}" stroke="${filled ? card.accentColor : muted}" stroke-width="2"/>`
  })
  const rows = Math.ceil(card.stampGoal / 6)
  const height = 250 + rows * 42
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="${height}" viewBox="0 0 360 ${height}">
  <rect width="360" height="${height}" rx="28" fill="${card.primaryColor}"/>
  <rect x="18" y="18" width="324" height="${height - 36}" rx="22" fill="none" stroke="${card.accentColor}" stroke-opacity="0.85"/>
  <text x="36" y="58" fill="${muted}" font-family="Georgia, serif" font-size="12" letter-spacing="2">${provider === "apple" ? "APPLE WALLET" : "GOOGLE WALLET"} · PREVIEW</text>
  <text x="36" y="96" fill="${ink}" font-family="Georgia, serif" font-size="28">${escapeXml(card.businessName)}</text>
  <text x="36" y="128" fill="${muted}" font-family="ui-sans-serif, sans-serif" font-size="14">${escapeXml(card.customerFirstName)}</text>
  <text x="36" y="176" fill="${ink}" font-family="Georgia, serif" font-size="42">${card.stamps}<tspan font-size="18" fill="${muted}"> / ${card.stampGoal}</tspan></text>
  <text x="250" y="168" fill="${card.accentColor}" font-family="ui-sans-serif, sans-serif" font-size="13">${card.rewardUnlocked ? "REWARD READY" : "IN PROGRESS"}</text>
  ${dots.join("\n  ")}
  <text x="36" y="${height - 58}" fill="${ink}" font-family="ui-sans-serif, sans-serif" font-size="13">${escapeXml(truncate(card.rewardText, 42))}</text>
  <text x="36" y="${height - 34}" fill="${muted}" font-family="ui-monospace, monospace" font-size="12">${escapeXml(card.code)}</text>
</svg>`
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function zipStore(files: { name: string; data: Buffer }[]) {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name)
    const checksum = crc32(file.data)
    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 8)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(file.data.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    name.copy(local, 30)
    locals.push(local, file.data)
    const central = Buffer.alloc(46 + name.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(file.data.length, 20)
    central.writeUInt32LE(file.data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    name.copy(central, 46)
    centrals.push(central)
    offset += local.length + file.data.length
  }
  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBuf, end])
}
