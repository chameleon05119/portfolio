// ハブ（作品一覧）固有の操作の確認。pj-chameleon の 30_engineering/tools/site-check/check.mjs の --flows に渡す
export default async ({ browser, base, check }) => {
  const works = async (p) => JSON.parse(await p.textContent('#works-data'))
  const pcSrc = (p) => p.$eval('#feedPc img', (i) => i.src).catch(() => '')

  // --- 遅い回線: ホバーしたらすぐその作品の絵が出て、読み込み後に本物に替わる ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => check(false, `JS の例外（ハブ）: ${e.message}`))
    const cdp = await ctx.newCDPSession(p)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: 1e6 })
    await p.goto(base, { waitUntil: 'domcontentloaded' })
    const ws = await works(p)
    const w = ws[1]
    const t = Date.now()
    await p.hover(`.card[data-id="${w.slug}"] h3`)
    // その作品のサムネイル（読み込み中の仮の絵）か本物の画像が出るまで待つ（最初から出ている別の作品の画像では満たさない）
    await p.waitForFunction(([slug, pc]) => {
      const th = document.querySelector(`.card[data-id="${slug}"] .thumb img`)
      const s = document.querySelector('#feedPc img')?.src || ''
      return (th && s === th.currentSrc) || s.endsWith(pc)
    }, [w.slug, w.pc], { timeout: 3000 }).catch(() => {})
    const firstMs = Date.now() - t
    check(firstMs < 600, `遅い回線でホバーしてから作品の絵が出るまで ${firstMs}ms（前の作品のまま）`)
    check((await p.textContent('#info .ttl')) === w.name, 'ホバーしても作品名が切り替わらない')
    await p.waitForFunction((pc) => document.querySelector('#feedPc img')?.src.endsWith(pc) && !document.querySelector('.stage').classList.contains('is-loading'), w.pc, { timeout: 30000 }).catch(() => {})
    check((await pcSrc(p)).endsWith(w.pc), '読み込みが終わっても本物のプレビュー画像に替わらない')
    await ctx.close()
  }

  // --- 通常: 全作品をホバーして切り替え・流れる・一時停止・絞り込み ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => check(false, `JS の例外（ハブ）: ${e.message}`))
    await p.goto(base, { waitUntil: 'networkidle' })
    const ws = await works(p)
    for (const w of [...ws.slice(1), ws[0]]) {
      await p.hover(`.card[data-id="${w.slug}"] h3`)
      await p.waitForFunction((pc) => document.querySelector('#feedPc img')?.src.endsWith(pc), w.pc, { timeout: 5000 }).catch(() => {})
      check((await pcSrc(p)).endsWith(w.pc), `ホバーしてもプレビューが ${w.slug} にならない`)
      check((await p.$eval('#feedSp img', (i) => i.src).catch(() => '')).endsWith(w.sp), `スマホのプレビューが ${w.slug} にならない`)
      check((await p.getAttribute('#qr', 'aria-label')).startsWith(w.name), `QR コードが ${w.slug} にならない`)
      check((await p.$eval('.card.is-active', (c) => c.dataset.id)) === w.slug, `カードの選択表示が ${w.slug} にならない`)
    }
    // 流れるか（マウスを外して数秒待つと位置が変わる）
    await p.mouse.move(5, 5)
    const y0 = await p.$eval('#feedPc', (f) => f.style.transform)
    await p.waitForTimeout(2600)
    const y1 = await p.$eval('#feedPc', (f) => f.style.transform)
    check(y0 !== y1, `プレビューが流れない（${y0} → ${y1}）`)
    await p.click('#pause')
    const a = await p.$eval('#feedPc', (f) => f.style.transform)
    await p.waitForTimeout(1500)
    check(a === (await p.$eval('#feedPc', (f) => f.style.transform)), '一時停止しても止まらない')
    await p.click('#pause')
    // 絞り込み
    await p.click('#filters .chip[data-f="lp"]')
    const shown = await p.$$eval('.card:not([hidden])', (cs) => cs.map((c) => c.dataset.f))
    check(shown.length > 0 && shown.every((f) => f === 'lp'), `LP で絞り込めない: ${shown}`)
    check(p.url().includes('type=lp'), '絞り込みが URL に反映されない')
    await ctx.close()
  }
  console.log('ハブの操作の確認: 完了')
}
