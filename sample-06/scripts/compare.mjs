// 実装のスクリーンショットをカンプ画像と重ね、ずれている場所を数値で出す
//
//   npm run build
//   npm run compare -- design/frames/<フレーム>.png [--page index.html] [--height 800] [--threshold 0.1]
//                      [--ignore 100-400,900-950] [--click .js-menu-toggle]
//
// ビューポート幅はカンプ画像の幅に合わせる（SP カンプなら 375 など）。
// 高さは 100vh を使う要素の大きさに効くので、カンプが想定する画面の高さを --height で渡す。
// --ignore: カンプ側の既知の不備（写っていない画像など）の y 範囲を、不一致率の集計から外す。
// --click: 要素をクリックした後の状態を撮る（メニュー・モーダルなど）。このときはフルページでなく画面だけ撮る。
// dist/ を file:// で開くので、サーバーは要らない。
//
// 出力: compare/<フレーム名>/
//   actual.png   実装のフルページ画像
//   diff.png     ずれたピクセルを赤で示した画像
//   overlay.png  カンプの上に実装を半透明で重ねた画像（目視確認用）
//   report.json  全体の不一致率、高さの差、ずれの大きい帯（上から何px付近か）

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import pixelmatch from 'pixelmatch'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'

const BAND = 100 // 帯の高さ(px)。この単位でずれを集計する

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}
const designPath = args.find((a) => a.endsWith('.png') && !a.startsWith('--'))
if (!designPath || !existsSync(designPath)) {
  console.error('使い方: npm run compare -- design/frames/<フレーム>.png [--page index.html]')
  process.exit(1)
}
const page = option('page', 'index.html')
const threshold = Number(option('threshold', '0.1'))
const viewportHeight = Number(option('height', '800'))
const ignore = (option('ignore', '') || '')
  .split(',')
  .filter(Boolean)
  .map((r) => r.split('-').map(Number))
const clickSelector = option('click', null)
const target = resolve('dist', page)
if (!existsSync(target)) {
  console.error(`${target} がありません。先に npm run build を実行してください`)
  process.exit(1)
}

const design = PNG.sync.read(readFileSync(designPath))
const outDir = join('compare', basename(designPath, '.png') + (option('click', null) ? '__click' : ''))
mkdirSync(outDir, { recursive: true })

// --- 実装を撮影 --------------------------------------------------------------
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
const context = await browser.newContext({
  viewport: { width: design.width, height: viewportHeight },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
})
const tab = await context.newPage()
await tab.goto(pathToFileURL(target).href, { waitUntil: 'networkidle' })
await tab.evaluate(() => document.fonts.ready)
// 遅延読み込みの画像を読ませるため一番下までスクロールしてから戻る
await tab.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
    scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 100))
  }
  scrollTo(0, 0)
})
if (clickSelector) {
  await tab.click(clickSelector)
  await tab.waitForTimeout(500)
}
const actualBuffer = await tab.screenshot({ fullPage: !clickSelector })
await browser.close()
writeFileSync(join(outDir, 'actual.png'), actualBuffer)
const actual = PNG.sync.read(actualBuffer)

// --- 同じキャンバスサイズにそろえて比較 ------------------------------------
const width = design.width
const height = Math.max(design.height, actual.height)
const a = pad(design, width, height)
const b = pad(actual, width, height)
const diff = new PNG({ width, height })
pixelmatch(a.data, b.data, diff.data, width, height, { threshold, diffMask: false })
writeFileSync(join(outDir, 'diff.png'), PNG.sync.write(diff))

const overlay = new PNG({ width, height })
for (let i = 0; i < overlay.data.length; i += 4) {
  for (let c = 0; c < 3; c++) overlay.data[i + c] = (a.data[i + c] + b.data[i + c]) >> 1
  overlay.data[i + 3] = 255
}
writeFileSync(join(outDir, 'overlay.png'), PNG.sync.write(overlay))

// 不一致ピクセル（diff.png の赤）を、除外範囲を除いて数える
const isIgnored = (y) => ignore.some(([from, to]) => y >= from && y < to)
const isRed = (i) => diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0
let mismatched = 0
let counted = 0
for (let y = 0; y < height; y++) {
  if (isIgnored(y)) continue
  counted += width
  for (let x = 0; x < width; x++) if (isRed((y * width + x) * 4)) mismatched++
}

// 帯ごとの不一致率
const bands = []
for (let top = 0; top < height; top += BAND) {
  const bottom = Math.min(top + BAND, height)
  if (isIgnored(top)) continue
  let count = 0
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < width; x++) if (isRed((y * width + x) * 4)) count++
  }
  bands.push({ y: `${top}-${bottom}`, mismatch: round((count / ((bottom - top) * width)) * 100) })
}

const report = {
  design: designPath,
  page,
  viewportWidth: width,
  designHeight: design.height,
  actualHeight: actual.height,
  heightDiff: actual.height - design.height,
  ignored: ignore.map(([from, to]) => `${from}-${to}`),
  clicked: clickSelector,
  mismatchPercent: round((mismatched / counted) * 100),
  worstBands: [...bands].sort((x, y) => y.mismatch - x.mismatch).filter((b) => b.mismatch > 1).slice(0, 10),
}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))

console.log(`不一致率 ${report.mismatchPercent}% / 高さ カンプ ${design.height}px → 実装 ${actual.height}px（差 ${report.heightDiff}px）`)
for (const band of report.worstBands) console.log(`  y=${band.y}: ${band.mismatch}%`)
console.log(`詳細: ${outDir}/`)

function pad(png, width, height) {
  if (png.width === width && png.height === height) return png
  const out = new PNG({ width, height })
  out.data.fill(255) // 足りない部分は白
  PNG.bitblt(png, out, 0, 0, Math.min(png.width, width), Math.min(png.height, height), 0, 0)
  return out
}

function round(n) {
  return Math.round(n * 100) / 100
}
