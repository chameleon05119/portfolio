// 広告バナーを PNG に書き出す（npm run banners）
//   banners/banners.html の .banner を 1 枚ずつ、指定サイズちょうど（等倍）で撮る
//   出力: src/public/banners/<data-name>.png（サイトの「広告バナー」ページと作品集から使う）
//         src/public/og.png（訴求 A の 1200×628 を、共有時の画像にも使う）
// Playwright のブラウザが入っていない環境では CHROMIUM_PATH に Chromium の場所を渡す
import { chromium } from 'playwright'
import { copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const src = new URL('./banners.html', import.meta.url)
const out = new URL('../src/public/banners/', import.meta.url)
await mkdir(out, { recursive: true })

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const page = await browser.newPage({ viewport: { width: 2600, height: 1400 }, deviceScaleFactor: 1 })
await page.goto(src.href, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)

for (const banner of await page.locator('.banner').all()) {
  const name = await banner.getAttribute('data-name')
  const path = fileURLToPath(new URL(`${name}.png`, out))
  await banner.screenshot({ path })
  const box = await banner.boundingBox()
  console.log(`${name}.png  ${box.width}×${box.height}`)
}
await copyFile(fileURLToPath(new URL('a-1200x628.png', out)), fileURLToPath(new URL('../src/public/og.png', import.meta.url)))
console.log('og.png（a-1200x628 のコピー）')
await browser.close()
