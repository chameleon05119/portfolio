// 比較ページ（src/index.html）に載せる、リニューアル前後のスクリーンショットを撮る
//   npm run build && npx vite preview --port 5190 &
//   npm run shots                       … http://localhost:5190/ から撮る
//   SHOT_BASE=http://localhost:4173/ npm run shots
// 出力: src/public/shots/*.jpg（git に入れる）。あわせて、比較ページの「数値で比べる」に使う値を表示する
// CHROMIUM_PATH に Chromium の場所を入れると、そのブラウザで撮る（playwright の同梱ブラウザが使えない環境向け）
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = process.env.SHOT_BASE ?? 'http://localhost:5190/'
const out = new URL('../src/public/shots/', import.meta.url).pathname
await mkdir(out, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

const PC = { viewport: { width: 1280, height: 800 } }
// スマホは実機と同じく viewport の指定を解釈させる（前のサイトは viewport がないので、PC の画面が縮小される）
const SP = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

async function open(path, device) {
  const ctx = await browser.newContext(device)
  const page = await ctx.newPage()
  await page.goto(base + path, { waitUntil: 'networkidle' })
  // スクロールで出す要素・点滅などを止めた状態で撮る。
  // Android の Chrome がする文字の自動拡大は止める（iPhone の Safari と同じ見え方で比べる）
  await page.addStyleTag({
    content:
      'html{-webkit-text-size-adjust:100%;text-size-adjust:100%}*,*::before,*::after{animation:none!important;transition:none!important}.u-reveal{opacity:1!important;transform:none!important}',
  })
  await page.waitForTimeout(600)
  return page
}

const jpg = (name) => ({ path: out + name + '.jpg', type: 'jpeg', quality: 82 })

// 複数の要素を囲む範囲を切り出す（見出しと本文をまとめて撮るときなど）
async function crop(page, selectors, name, pad = 16) {
  const rects = []
  for (const sel of selectors) {
    const r = await page.locator(sel).first().boundingBox()
    if (!r) throw new Error(`見つからない: ${sel}`)
    rects.push(r)
  }
  const x = Math.max(0, Math.min(...rects.map((r) => r.x)) - pad)
  const y = Math.max(0, Math.min(...rects.map((r) => r.y)) - pad)
  const right = Math.max(...rects.map((r) => r.x + r.width)) + pad
  const bottom = Math.max(...rects.map((r) => r.y + r.height)) + pad
  await page.screenshot({ ...jpg(name), clip: { x, y, width: right - x, height: bottom - y }, fullPage: true })
}

// --- 最初の画面（PC・スマホ） ---
for (const [key, path] of [['before', 'before/index.html'], ['after', 'after/index.html']]) {
  const pc = await open(path, PC)
  await pc.screenshot(jpg(`${key}-pc`))
  const sp = await open(path, SP)
  await sp.screenshot(jpg(`${key}-sp`))

  // 数値で比べる: スマホで見たときの本文の文字の大きさ（CSS の文字サイズ × 画面の縮小率）
  const m = await sp.evaluate(() => ({ font: parseFloat(getComputedStyle(document.body).fontSize), width: document.documentElement.clientWidth }))
  console.log(key, 'スマホの本文', m.font, 'px × 縮小', (390 / m.width).toFixed(3), '=', ((m.font * 390) / m.width).toFixed(1), 'px')
  await pc.context().close()
  await sp.context().close()
}

// --- 課題と改善（PC 幅で切り出す） ---
const b = await open('before/index.html', PC)
await crop(b, ['#mainimage'], 'before-message', 0)
await crop(b, ['#price', '#price + p'], 'before-price')
await crop(b, ['#service', '.service'], 'before-service')
await crop(b, ['#contact', '#contact + p'], 'before-contact')
await crop(b, ['.title:first-child', '.news'], 'before-news')
const a = await open('after/index.html', PC)
await crop(a, ['.p-fv__body'], 'after-message', 24)
await crop(a, ['.p-price__plans'], 'after-price', 24)
await crop(a, ['.p-service__list'], 'after-service', 24)
await crop(a, ['.p-contact__cols'], 'after-contact', 24)
await crop(a, ['.p-news__title', '.p-news__list'], 'after-news', 24)
await browser.close()
console.log('shots →', out)
