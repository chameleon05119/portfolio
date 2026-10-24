// site-check（30_engineering/tools/site-check）に渡す、この作品だけの操作の確認
//   node <site-check>/check.mjs http://localhost:4321/portfolio/sample-12/ --flows scripts/site-check.flows.mjs
export default async ({ browser, base, check }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(base, { waitUntil: 'load' })
  const opacity = () => page.evaluate(() => getComputedStyle(document.querySelector('.story'), '::before').opacity)
  check((await opacity()) === '0', 'ストーリーズの範囲表示: 最初は隠れている')
  await page.click('label[for="safe"]')
  await page.waitForTimeout(300)
  check((await opacity()) === '1', 'ストーリーズの範囲表示: チェックで表示される')
  await page.keyboard.press('Space') // フォーカスが残っていればキーボードでも切り替わる
  await page.waitForTimeout(300)
  check((await opacity()) === '0', 'ストーリーズの範囲表示: キーボードでも切り替えられる')
  for (const pdf of ['out/flyer-print.pdf', 'out/flyer-a4.pdf', 'out/slides.pdf']) {
    const res = await page.request.get(new URL(pdf, base).href)
    check(res.ok() && (res.headers()['content-type'] || '').includes('pdf'), `${pdf} が PDF として開ける`)
  }
  await page.close()
}
