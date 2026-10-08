// sample-08 固有の操作の確認。30_engineering/tools/site-check/check.mjs の --flows に渡す
export default async ({ browser, base, check }) => {
  const page = async (opts = {}, time) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => check(false, `JS の例外（操作中）: ${e.message}`))
    if (time) await p.clock.setFixedTime(new Date(time)) // 端末の時計を固定して受付状況を確かめる
    return p
  }
  const pressed = (p, sel) => p.getAttribute(sel, 'aria-pressed')
  const text = (p, sel) => p.textContent(sel).then((t) => t.trim())

  // --- 症状から探す: 図とボタンの連動・ラジオの矢印キー・絞り込み・該当なし・詳しいページへのリンク ---
  {
    const p = await page()
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    const f = '#symptom'
    const status = () => text(p, `${f} [data-finder-status]`)
    check(await p.locator(`${f} [data-finder-fallback]`).count() === 0, 'JS が動いても「症状から探す」の代わりの文が残っている')
    check((await status()) === '腰（痛い）：5件', `最初の状態が「腰・痛い 5件」でない: ${await status()}`)
    check(await p.locator(`${f} [data-finder-result] a[href="medical/lumbago.html"]`).count() === 1, '腰痛症の詳しいページへのリンクがない')
    check((await p.getAttribute(`${f} [data-finder-parts]`, 'role')) === 'radiogroup', '「場所」がラジオボタンのグループになっていない')
    check((await p.getAttribute(`${f} [data-finder-map]`, 'aria-hidden')) === 'true', 'からだの図が読み上げの対象になっている（ボタンと二重になる）')
    await p.click(`${f} .p-finder__spot[data-part="knee"]`)
    check((await p.getAttribute(`${f} .c-chip[data-part="knee"]`, 'aria-checked')) === 'true', '図の「ひざ」を押してもボタンが選ばれない')
    check((await p.getAttribute(`${f} .c-chip[data-part="back"]`, 'aria-checked')) === 'false', '図で別の場所を押しても前の場所が選ばれたまま')
    check((await status()) === 'ひざ（痛い）：2件', `ひざ・痛いの読み上げ文が違う: ${await status()}`)
    await p.click(`${f} .c-chip[data-sym="けがをした"]`)
    check((await p.locator(`${f} [data-finder-result] li`).count()) === 3, 'ひざ・痛い＋けがで 3 件にならない')
    check((await text(p, `${f} [data-finder-result] h3`)).includes('のどれかに当てはまる'), '症状を 2 つ選んだときに「どれかに当てはまる」と書かれない')
    await p.click(`${f} .c-chip[data-part="elbow"]`)
    check(await p.locator(`${f} .p-finder__spot[data-part="elbow"]`).evaluate((e) => e.classList.contains('is-selected')), 'ボタンの「ひじ」を押しても図の丸が選ばれない')
    // ラジオの矢印キー: ひじ → 右で手・指
    await p.focus(`${f} .c-chip[data-part="elbow"]`)
    await p.keyboard.press('ArrowRight')
    check((await p.getAttribute(`${f} .c-chip[data-part="hand"]`, 'aria-checked')) === 'true' && (await p.evaluate(() => document.activeElement.dataset.part)) === 'hand', '右矢印で次の場所（手・指）に移らない')
    check((await p.locator(`${f} [data-finder-parts] [tabindex="0"]`).count()) === 1, '場所のボタンの Tab で止まる場所が 1 つでない')
    await p.click(`${f} .c-chip[data-part="neck"]`)
    await p.click(`${f} .c-chip[data-sym="痛い"]`) // 痛いを外す → 首・けが のみ
    check((await p.locator(`${f} .p-finder__empty`).count()) === 1, '首・けがで「該当なし」の文が出ない')
    check((await status()) === '首（けがをした）：該当なし', `該当なしが読み上げられない: ${await status()}`)
    await p.click(`${f} .c-chip[data-sym="けがをした"]`) // 症状なし → その場所の病気をすべて
    check((await p.locator(`${f} [data-finder-result] li`).count()) === 3, '症状を全部外したときに首の病気がすべて出ない')
    const box = await p.locator(`${f} .p-finder__spot`).first().boundingBox()
    check(box && box.width >= 44, `図の丸の押せる大きさが 44px 未満: ${box?.width}`)
    // 診療時間・休診日の文は data.js から作る
    check((await text(p, '.l-footer [data-clinic-text="closed"]')) === '木曜・土曜午後・日曜・祝日', `フッターの休診日が data.js と合わない: ${await text(p, '.l-footer [data-clinic-text="closed"]')}`)
    check((await text(p, '.p-fv__hours [data-clinic-text="last"]')) === '受付は終了の 15 分前まで', '受付の締め切りの文が data.js と合わない')
    await p.context().close()
  }

  // --- 受付状況・時間表・臨時休診の帯（時計を固定） ---
  // [時刻, 受付状況, 補足, バッジの状態, 臨時休診の帯, 今日として強調する列]
  const cases = [
    ['2026-10-05T10:00:00', '午前の受付中', '受付は 11:45 まで', 'open', true, '月'],
    ['2026-10-05T13:00:00', '午後は 15:00 から', '受付は 14:30 から', 'wait', true, '月'],
    ['2026-10-05T19:00:00', '本日の受付は終了', '明日は 9:00 から', 'closed', true, '月'],
    ['2026-10-08T10:00:00', '本日休診', '明日は 9:00 から', 'closed', true, '木'], // 木曜
    ['2026-10-12T10:00:00', '本日休診', '祝日／明日は 9:00 から', 'closed', true, '日祝'], // スポーツの日
    ['2026-10-17T10:00:00', '本日休診', '院長の学会出席のため／次は 10月19日（月） 9:00 から', 'closed', true, '土'], // 臨時休診（土曜）
    ['2026-10-02T10:00:00', '午前の受付中', '受付は 11:45 まで', 'open', false, '金'], // 臨時休診の 15 日前 → 帯は出ない
  ]
  for (const [time, status, note, state, alert, col] of cases) {
    const p = await page({}, time)
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    check((await text(p, '[data-today-status]')) === status, `${time} の受付状況が「${status}」でない: ${await text(p, '[data-today-status]')}`)
    check((await text(p, '[data-today-note]')) === note, `${time} の補足が「${note}」でない: ${await text(p, '[data-today-note]')}`)
    check((await p.getAttribute('[data-today-status]', 'data-state')) === state, `${time} のバッジの色（${state}）が違う`)
    check((await p.locator('[data-closed-alert]').isVisible()) === alert, `${time} の臨時休診の帯が${alert ? '出ない' : '出ている'}`)
    check((await text(p, '.p-fv__hours thead th.is-today')).startsWith(col), `${time} に今日の列（${col}）が強調されない`)
    check((await p.locator('.p-access__hours .is-today').count()) === 0, 'アクセスの時間表で今日が強調されている（強調しない設定）')
    if (time.startsWith('2026-10-17')) check((await p.locator('#panel-time tbody td.is-today', { hasText: '休' }).count()) === 2, '臨時休診の日に、今日の列が「休」にならない')
    await p.context().close()
  }

  // --- 午後だけの臨時休診（data.js に 1 行足したのと同じ状態にして確かめる） ---
  for (const [time, status, note] of [
    ['2026-10-06T10:00:00', '午前の受付中', '受付は 11:45 まで'],
    ['2026-10-06T16:00:00', '本日の受付は終了', '院内研修のため／明日は 9:00 から'],
  ]) {
    const p = await page({}, time)
    await p.route('**/assets/js/data.js', async (route) => {
      const res = await route.fetch()
      route.fulfill({ response: res, body: (await res.text()) + "\nwindow.CLINIC.closed.push({ date: '2026-10-06', reason: '院内研修のため', slots: ['午後'] })\n" })
    })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    check((await text(p, '[data-today-status]')) === status, `午後休診の日 ${time} の受付状況が「${status}」でない: ${await text(p, '[data-today-status]')}`)
    check((await text(p, '[data-today-note]')) === note, `午後休診の日 ${time} の補足が「${note}」でない: ${await text(p, '[data-today-note]')}`)
    check((await text(p, '[data-closed-alert-text]')).includes('10月6日（火）の午後は'), `午後休診の帯の文が違う: ${await text(p, '[data-closed-alert-text]')}`)
    const pm = await p.locator('#panel-time tbody tr').nth(1).locator('td.is-today').textContent()
    check(pm.includes('休'), '午後休診の日に、今日の午後の欄が「休」にならない')
    await p.context().close()
  }

  // --- 診療時間／担当医のタブ（クリック・矢印キー・Home・End） ---
  {
    const p = await page()
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    await p.click('#tab-doctor')
    check(!(await p.isHidden('#panel-doctor')) && (await p.isHidden('#panel-time')), 'タブを押しても担当医の表に切り替わらない')
    check((await p.locator('#panel-doctor td', { hasText: '佐倉 医師' }).count()) === 1, '担当医の表に土曜の担当医がない')
    await p.keyboard.press('ArrowLeft')
    check((await p.evaluate(() => document.activeElement.id)) === 'tab-time' && !(await p.isHidden('#panel-time')), '左矢印で診療時間のタブに戻らない')
    await p.keyboard.press('End')
    check((await p.getAttribute('#tab-doctor', 'aria-selected')) === 'true', 'End キーで最後のタブにならない')
    await p.context().close()
  }

  // --- Web 予約のダイアログ（PC のヘッダー・閉じたらボタンへフォーカス） ---
  {
    const p = await page()
    await p.goto(base + 'first.html', { waitUntil: 'networkidle' })
    await p.click('.l-header__cta [data-reserve]')
    check(await p.evaluate(() => document.getElementById('reserve-dialog').open), 'Web 予約のダイアログが開かない')
    await p.keyboard.press('Escape')
    check(!(await p.evaluate(() => document.getElementById('reserve-dialog').open)), 'Esc でダイアログが閉じない')
    check(await p.evaluate(() => document.activeElement.matches('.l-header__cta [data-reserve]')), 'ダイアログを閉じても予約ボタンにフォーカスが戻らない')
    check(!(await p.locator('.l-fixbar').isVisible()), 'PC で画面下の予約バーが出ている')
    await p.context().close()
  }

  // --- スマホ: メニュー・予約バー ---
  {
    const p = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    check(await p.locator('.l-fixbar').isVisible(), 'スマホで画面下の予約バーが出ない')
    await p.click('.l-header__menu')
    await p.waitForTimeout(400)
    check(await p.evaluate(() => document.querySelector('main').inert && document.querySelector('.l-fixbar').inert), 'メニューを開いても背面（本文・予約バー）が操作できる')
    check(await p.evaluate(() => document.activeElement.closest('#drawer') !== null), 'メニューを開いても中にフォーカスが移らない')
    await p.keyboard.press('Escape')
    await p.waitForTimeout(400)
    check(await p.isHidden('#drawer'), 'Esc でメニューが閉じない')
    check(await p.evaluate(() => document.activeElement.matches('.l-header__menu')), 'メニューを閉じてもボタンにフォーカスが戻らない')
    check((await p.getAttribute('.l-header__menu', 'aria-label')) === 'メニュー', 'メニューボタンのラベルが開閉で変わっている（状態は aria-expanded で伝える）')
    await p.tap('.l-fixbar [data-reserve]')
    check(await p.evaluate(() => document.getElementById('reserve-dialog').open), '予約バーからダイアログが開かない')
    await p.context().close()
  }

  // --- 写真の拡大（リハビリ・医師） ---
  for (const path of ['rehab.html', 'doctor.html']) {
    const p = await page()
    await p.goto(base + path, { waitUntil: 'networkidle' })
    await p.locator('[data-lightbox] button').first().click()
    // 大きい画像を読み込んでから開くので、開くまで待つ
    const opened = await p.waitForFunction(() => document.querySelector('.p-lightbox').open, null, { timeout: 5000 }).then(() => true, () => false)
    check(opened, `${path} で写真の拡大が開かない`)
    check(/-(960|1200)w\.webp$/.test(await p.getAttribute('.p-lightbox img', 'src')), `${path} の拡大に大きい画像が使われない`)
    await p.click('.p-lightbox button')
    check(!(await p.evaluate(() => document.querySelector('.p-lightbox').open)), `${path} で写真の拡大が閉じない`)
    await p.context().close()
  }

  // --- お知らせの絞り込み ---
  {
    const p = await page()
    await p.goto(base + 'news.html', { waitUntil: 'networkidle' })
    await p.click('.p-news-filter [data-cat="closed"]')
    check((await p.locator('[data-news-list] li:visible').count()) === 2, '「休診」で絞り込んで 2 件にならない')
    check((await text(p, '[data-news-status]')) === '休診：2件', '絞り込みの件数が読み上げられない')
    await p.context().close()
  }

  // --- 記事の目次（今読んでいる見出し） ---
  {
    const p = await page()
    await p.goto(base + 'medical/lumbago.html', { waitUntil: 'networkidle' })
    await p.click('.p-toc a[href="#treatment"]')
    await p.waitForTimeout(800)
    check((await p.getAttribute('.p-toc a[href="#treatment"]', 'aria-current')) === 'location', '目次で選んだ見出しが「今読んでいる」にならない')
    await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    await p.waitForTimeout(400)
    check((await p.getAttribute('.p-toc a[href="#sign"]', 'aria-current')) === 'location', 'ページの最後まで来ても、最後の見出しが「今読んでいる」にならない')
    await p.context().close()
  }

  // --- JS が動かないとき: 中身が読める ---
  {
    const p = await page({ javaScriptEnabled: false })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    check(await p.locator('#symptom [data-finder-fallback]').isVisible(), 'JS なしで「症状から探す」の代わりの案内が出ない')
    check(!(await p.locator('#symptom .p-finder__map').isVisible()), 'JS なしで動かないからだの図が出ている')
    check((await text(p, '#panel-time')).includes('9:00〜12:00'), 'JS なしで診療時間が読めない')
    check(await p.locator('#panel-doctor').isVisible(), 'JS なしで担当医が読めない')
    check(!(await p.locator('.c-tabs').isVisible()), 'JS なしで押しても動かないタブが出ている')
    check(await p.locator('#feature .c-grid').isVisible(), 'JS なしでふわっと表示の要素が隠れている')
    check(!(await p.locator('[data-today]').isVisible()), 'JS なしで中身のない「今日は」が出ている')
    await p.goto(base + 'news.html', { waitUntil: 'networkidle' })
    check(!(await p.locator('.p-news-filter').isVisible()), 'JS なしで押しても動かない絞り込みボタンが出ている')
    await p.context().close()
  }

  // --- 最初の画面: 説明の箱と時間表のカードが重ならない（768px 以上で両方が写真に重なる配置になる） ---
  for (const width of [768, 800, 860, 900, 1024, 1120, 1280, 1440]) {
    const p = await page({ viewport: { width, height: 900 } })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    const [a, b] = await Promise.all(['.p-fv__lead', '.p-fv__hours'].map((s) => p.locator(s).boundingBox()))
    const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    check(!overlap, `${width}px で最初の画面の説明と時間表のカードが重なっている`)
    await p.context().close()
  }
}
