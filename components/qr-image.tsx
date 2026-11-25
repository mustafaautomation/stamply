"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

export function QrImage({
  path,
  alt,
  size = 168,
  dark = "#1c1410",
}: {
  path: string
  alt: string
  size?: number
  dark?: string
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const url = `${window.location.origin}${path}`
    QRCode.toDataURL(url, {
      margin: 1,
      width: size * 2,
      color: { dark, light: "#00000000" },
    })
      .then(setSrc)
      .catch(() => setFailed(true))
  }, [path, size, dark])

  if (failed) {
    return <p className="text-sm text-[#6e6258]">QR unavailable. Open the card link instead.</p>
  }
  if (!src) {
    return <div className="animate-pulse rounded-2xl bg-black/5" style={{ width: size, height: size }} />
  }
  return <img src={src} alt={alt} width={size} height={size} className="rounded-2xl" />
}
