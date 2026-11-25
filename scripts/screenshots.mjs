import { chromium } from "@playwright/test"
import { mkdir } from "node:fs/promises"

const base = process.env.BASE_URL || "http://127.0.0.1:43123"
const dir = "docs/screenshots"
await mkdir(dir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

await page.goto(base)
await page.screenshot({ path: `${dir}/landing.png`, fullPage: true })

const phone = await browser.newPage({ viewport: { width: 390, height: 844 } })
await phone.goto(`${base}/c/LUMEN-MAYA?demo=1`)
await phone.getByTestId("stamp-count").waitFor()
await phone.screenshot({ path: `${dir}/customer-card.png`, fullPage: true })

await page.goto(`${base}/login`)
await page.getByLabel("Email").fill("owner@lumencoffee.demo")
await page.getByLabel("Password").fill("stamply-demo")
await page.getByRole("button", { name: "Sign in" }).click()
await page.waitForURL("**/dashboard")
await page.getByRole("heading", { name: "Lumen Coffee" }).waitFor()
await page.screenshot({ path: `${dir}/dashboard.png`, fullPage: true })

await page.goto(`${base}/dashboard/punch`)
await page.getByLabel("Phone, email, or card code").fill("LUMEN-MAYA")
await page.getByRole("button", { name: "Find or create card" }).click()
await page.getByText("Maya Chen").waitFor()
await page.screenshot({ path: `${dir}/punch.png`, fullPage: true })

await browser.close()
console.log("wrote screenshots")
