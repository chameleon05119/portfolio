// チラシ・資料・バナーを書き出す
//   npm run export
// 1. vite build でページを組み立てる
// 2. dist/ の原稿をブラウザで開き、PDF と画像を src/public/out/ に書き出す
//    - flyer-print.pdf   … 入稿用（塗り足し 3mm 込み 216×303mm・2 ページ）
//    - flyer-a4.pdf      … 確認用（仕上がり A4・2 ページ）
//    - flyer-front.jpg / flyer-back.jpg … 紹介ページ用のプレビュー（仕上がりの大きさ）
//    - slides.pdf        … 説明資料（16:9・8 ページ）
//    - slide-1.jpg 〜 slide-8.jpg … 紹介ページ用のプレビュー
//    - banner-*.png      … Meta 広告バナー（実寸）
//    - ../ogp.jpg        … SNS でシェアされたときの画像（紹介ページの最初の画面）
// 3. もう一度 vite build して、書き出したファイルを dist/out/ に入れる
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const OUT = 'src/public/out'
const fileUrl = (p) => pathToFileURL(resolve('dist', p)).href

execSync('npx vite build', { stdio: 'inherit' })
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())

async function open(path, { trim = false, viewport = { width: 1400, height: 1000 }, scale = 1 } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale })
  await page.goto(fileUrl(path), { waitUntil: 'networkidle' })
  if (trim) await page.evaluate(() => document.documentElement.classList.add('is-trim'))
  await page.evaluate(() => document.fonts.ready)
  return page
}

// ----- チラシ -----
{
  const page = await open('flyer/index.html')
  await page.pdf({ path: `${OUT}/flyer-print.pdf`, width: '216mm', height: '303mm', printBackground: true, preferCSSPageSize: true })
  await page.close()
}
{
  const page = await open('flyer/index.html', { trim: true })
  await page.pdf({ path: `${OUT}/flyer-a4.pdf`, format: 'A4', printBackground: true })
  await page.close()
}
{
  // プレビュー画像は仕上がりの大きさで、少し高解像度に撮る
  const page = await open('flyer/index.html', { trim: true, scale: 1.5 })
  for (const side of ['front', 'back']) {
    await page.locator(`#flyer-${side}`).screenshot({ path: `${OUT}/flyer-${side}.jpg`, type: 'jpeg', quality: 85 })
  }
  await page.close()
}

// ----- 説明資料 -----
{
  const page = await open('slides/index.html')
  await page.pdf({ path: `${OUT}/slides.pdf`, width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true })
  const count = await page.locator('.slide').count()
  for (let i = 1; i <= count; i++) {
    await page.locator(`#slide-${i}`).screenshot({ path: `${OUT}/slide-${i}.jpg`, type: 'jpeg', quality: 85 })
  }
  await page.close()
}

// ----- バナー -----
{
  const page = await open('banners/source.html', { viewport: { width: 1200, height: 2000 } })
  for (const id of ['a-feed', 'a-story', 'b-feed', 'b-story', 'c-feed', 'c-story']) {
    await page.locator(`#${id}`).screenshot({ path: `${OUT}/banner-${id}.png` })
  }
  await page.close()
}

// ----- OGP 画像（チラシ・資料・バナーを並べた 1200×630） -----
{
  const page = await open('index.html', { viewport: { width: 1200, height: 630 } })
  const img = (f) => pathToFileURL(resolve(OUT, f)).href
  await page.evaluate(({ front, slide, feed, story }) => {
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;background:#2563a8;overflow:hidden;font-family:'Zen Maru Gothic',sans-serif">
        <p style="position:absolute;left:56px;top:48px;margin:0;color:#fff;font-weight:900;font-size:46px;line-height:1.35">冬期講習の<br>販促物一式</p>
        <p style="position:absolute;left:56px;top:190px;margin:0;color:#ffcf4a;font-weight:700;font-size:22px">チラシ・説明資料・Meta 広告バナー</p>
        <img src="${slide}" style="position:absolute;left:56px;top:270px;width:470px;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.25)">
        <img src="${front}" style="position:absolute;left:560px;top:48px;width:300px;border-radius:6px;box-shadow:0 12px 30px rgba(0,0,0,.25)">
        <img src="${feed}" style="position:absolute;left:890px;top:48px;width:250px;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.25)">
        <img src="${story}" style="position:absolute;left:890px;top:320px;width:140px;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.25)">
        <p style="position:absolute;left:56px;bottom:22px;margin:0;color:#fff;opacity:.85;font-family:sans-serif;font-size:16px">※ 架空の塾のデモです（制作サンプル）</p>
      </div>`
  }, { front: img('flyer-front.jpg'), slide: img('slide-1.jpg'), feed: img('banner-b-feed.png'), story: img('banner-a-story.png') })
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth))
  await page.screenshot({ path: 'src/public/ogp.jpg', type: 'jpeg', quality: 85 })
  await page.close()
}

await browser.close()
execSync('npx vite build', { stdio: 'inherit' })
console.log(`書き出し: ${OUT}/`)
