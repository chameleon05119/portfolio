// 縦長LP画像（src/tall/source.html の 5 つの区切り）を PNG に書き出す
//   npm run tall
// 先に vite build でページを組み立て、dist/tall/source.html をブラウザで開いて区切りごとに撮影する。
// 出力先は src/public/tall/（ビルドのたびに dist/tall/ へコピーされる）。最後にもう一度 build する
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const COUNT = 5
const OUT = 'src/public/tall'

execSync('npx vite build', { stdio: 'inherit' })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
const page = await browser.newPage({ viewport: { width: 900, height: 1600 } })
await page.goto(pathToFileURL(resolve('dist/tall/source.html')).href, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
for (let i = 1; i <= COUNT; i++) {
  const path = `${OUT}/tall-${i}.png`
  // 位置が小数になると高さが 1px ずれるので、区切りの左上から 750×1500 ちょうどで切り出す
  const box = await page.locator(`#tall-${i}`).boundingBox()
  await page.screenshot({ path, fullPage: true, clip: { x: Math.round(box.x), y: Math.round(box.y), width: 750, height: 1500 } })
  console.log(path)
}
await browser.close()

execSync('npx vite build', { stdio: 'inherit' })
