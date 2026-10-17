// 広告バナー（src/banners/source.html）を PNG に書き出す
//   npm run banners
// 先に vite build でページを組み立て、dist/banners/source.html をブラウザで開いて要素ごとに撮影する。
// 出力先は src/public/banners/（ビルドのたびに dist/banners/ へコピーされる）。最後にもう一度 build する
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const BANNERS = [
  { id: 'banner-square', file: 'square-1080x1080', scales: [1] },
  { id: 'banner-wide', file: 'wide-1200x628', scales: [1] },
  { id: 'banner-sp', file: 'sp-320x100', scales: [1, 2] }, // スマホ用は高解像度の画面向けに 2 倍も作る
]
const OUT = 'src/public/banners'

execSync('npx vite build', { stdio: 'inherit' })
mkdirSync(OUT, { recursive: true })

const url = pathToFileURL(resolve('dist/banners/source.html')).href
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
for (const scale of [1, 2]) {
  const targets = BANNERS.filter((b) => b.scales.includes(scale))
  if (!targets.length) continue
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: scale })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  for (const b of targets) {
    const name = scale === 1 ? `${b.file}.png` : `${b.file}@${scale}x.png`
    await page.locator(`#${b.id}`).screenshot({ path: `${OUT}/${name}` })
    console.log(`${OUT}/${name}`)
  }
  await page.close()
}
await browser.close()

execSync('npx vite build', { stdio: 'inherit' })
