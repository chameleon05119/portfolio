// sample-06 固有の操作の確認。30_engineering/tools/site-check/check.mjs の --flows に渡す
export default async ({ browser, base, check }) => {
  const page = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => check(false, `JS の例外（操作中）: ${e.message}`))
    return p
  }
  const visible = (p, sel) => p.locator(sel).first().isVisible()
  const dialogOpen = (p) => p.evaluate(() => document.getElementById('signup').open)

  // --- LP（スマホ）: 追従ボタン → モーダル ---
  {
    const p = await page()
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    check(!(await visible(p, '.l-header__nav')) && !(await visible(p, '.l-header__actions')), 'スマホのヘッダーにナビ・ボタンが出ている')
    const fix = p.locator('[data-fixed-cta]')
    check(!(await fix.evaluate((el) => el.classList.contains('is-shown'))), '追従ボタンが最初の画面で出ている')
    await p.evaluate(() => scrollTo({ top: 2500, behavior: 'instant' }))
    await p.waitForTimeout(500)
    check(await fix.evaluate((el) => el.classList.contains('is-shown') && !el.inert), '追従ボタンが最初の画面を過ぎても出ない')
    await p.locator('[data-last-cta]').scrollIntoViewIfNeeded()
    await p.waitForTimeout(500)
    check(await fix.evaluate((el) => !el.classList.contains('is-shown') && el.inert), '最後の CTA が見えても追従ボタンが隠れない')
    await p.evaluate(() => scrollTo({ top: 2500, behavior: 'instant' }))
    await p.waitForTimeout(500)
    const opener = fix.locator('[data-open="trial"]')
    await opener.click()
    await p.waitForTimeout(400)
    check(await dialogOpen(p), '追従ボタンでモーダルが開かない')
    const box = await p.locator('#signup').boundingBox()
    check(box && box.width >= 389 && box.height >= 840, `スマホでモーダルが画面いっぱいにならない: ${JSON.stringify(box)}`)
    check((await p.textContent('#signup-title')).includes('無料'), 'trial のタイトルにならない')
    check(await visible(p, '[data-mode-only="trial"]'), 'trial で SNS の選択肢が出ない')
    check(!(await visible(p, '[data-mode-only="consult"]')), 'trial でご相談内容が出ている')
    // 空で送信 → エラーと最初の項目へのフォーカス
    await p.click('[data-signup-form] button[type="submit"]')
    const errs = await p.$$eval('.c-form__error', (els) => els.map((e) => e.textContent).filter(Boolean))
    check(errs.length === 4, `空で送信したときのエラーが 4 件でない: ${errs}`)
    check((await p.evaluate(() => document.activeElement.id)) === 'f-shop', '空で送信したとき最初の項目にフォーカスしない')
    check((await p.getAttribute('#f-email', 'aria-invalid')) === 'true', 'メールの aria-invalid が付かない')
    // 直すとその場でエラーが消える
    await p.fill('#f-shop', 'テスト珈琲')
    check((await p.textContent('#f-shop-error')) === '', '入力してもお店の名前のエラーが消えない')
    await p.fill('#f-email', 'abc')
    await p.locator('#f-email').blur()
    check((await p.textContent('#f-email-error')).includes('形式'), 'メールの形式エラーが出ない')
    await p.fill('#f-email', 'shop@example.jp')
    check((await p.textContent('#f-email-error')) === '', '正しいメールにしてもエラーが消えない')
    await p.locator('.c-chips label', { hasText: '美容室' }).first().click()
    check((await p.textContent('#f-kind-error')) === '', '業種を選んでもエラーが消えない')
    await p.locator('.c-form__agree input').check()
    await p.click('[data-signup-form] button[type="submit"]')
    check(await visible(p, '[data-dialog-step="done"]'), '送信しても完了にならない')
    check((await p.getAttribute('#signup', 'aria-labelledby')) === 'signup-done-title', '完了したのにダイアログの名前が入力画面の見出しのまま')
    check((await p.evaluate(() => document.activeElement.tagName)) === 'H2', '完了の見出しにフォーカスが移らない')
    // 閉じると押したボタンにフォーカスが戻る
    await p.keyboard.press('Escape')
    await p.waitForTimeout(300)
    check(!(await dialogOpen(p)), 'Esc でモーダルが閉じない')
    check(await opener.evaluate((el) => el === document.activeElement), '閉じたあと押したボタンにフォーカスが戻らない')
    // もう一度開くと最初の状態に戻っている
    await opener.click()
    await p.waitForTimeout(300)
    check((await visible(p, '[data-dialog-step="input"]')) && (await p.inputValue('#f-shop')) === '', '開き直しても入力画面・空の状態に戻らない')
    await p.click('.c-dialog__close')
    await p.waitForTimeout(300)
    check(!(await dialogOpen(p)), '✕ でモーダルが閉じない')
    await p.context().close()
  }

  // --- LP（PC）: ナビ・モーダルの種類・タブ・シミュレーター・スライダー・FAQ・帯 ---
  {
    const p = await page({ viewport: { width: 1440, height: 900 } })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    for (const id of ['feature', 'usecase', 'func', 'price', 'case', 'faq']) {
      await p.locator(`.l-header__nav a[href$="#${id}"]`).click()
      await p.waitForTimeout(900)
      const top = await p.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, id)
      const header = await p.evaluate(() => document.querySelector('.l-header').getBoundingClientRect().bottom)
      check(top >= header - 2 && top < 200, `ナビ「#${id}」で移動した先がヘッダーに隠れる・ずれる（top ${Math.round(top)}）`)
    }
    // モーダルの種類
    for (const [mode, title, onlyShown] of [['doc', '資料', null], ['consult', '相談', 'consult']]) {
      await p.locator(`[data-open="${mode}"]`).first().click()
      await p.waitForTimeout(300)
      check(await dialogOpen(p), `${mode} でモーダルが開かない`)
      check((await p.textContent('#signup-title')).includes(title), `${mode} のタイトルが違う`)
      check((await visible(p, '[data-mode-only="consult"]')) === (onlyShown === 'consult'), `${mode} でご相談内容の表示が違う`)
      check(!(await visible(p, '[data-mode-only="trial"]')), `${mode} で SNS の選択肢が出ている`)
      check((await p.evaluate(() => document.activeElement.id)) === 'f-shop', `${mode} で開いたとき最初の入力欄にフォーカスしない`)
      // 上の色の帯を押しても閉じない
      const r = await p.locator('#signup').boundingBox()
      await p.mouse.click(r.x + r.width / 2, r.y + 3)
      check(await dialogOpen(p), `${mode} で上の色の帯を押すと閉じてしまう`)
      // 背景を押すと閉じる
      await p.mouse.click(10, 450)
      await p.waitForTimeout(300)
      check(!(await dialogOpen(p)), `${mode} で背景を押しても閉じない`)
    }
    // タブ
    const tabs = p.locator('[role="tab"]')
    check(await visible(p, '[role="tablist"]'), 'タブが出ない')
    await tabs.nth(1).click()
    check((await visible(p, '#panel-salon')) && !(await visible(p, '#panel-cafe')), 'タブを押しても切り替わらない')
    await p.keyboard.press('ArrowRight')
    check((await tabs.nth(2).getAttribute('aria-selected')) === 'true' && (await visible(p, '#panel-bakery')), '→ キーで次のタブに移らない')
    check(await tabs.nth(2).evaluate((el) => el === document.activeElement && el.tabIndex === 0), '→ キーでフォーカス・tabindex が移らない')
    await p.keyboard.press('End')
    check((await tabs.nth(3).getAttribute('aria-selected')) === 'true', 'End キーで最後のタブに移らない')
    await p.keyboard.press('ArrowRight')
    check((await tabs.nth(0).getAttribute('aria-selected')) === 'true', '最後のタブで → を押しても最初に戻らない')
    // シミュレーター
    const sim = p.locator('[data-sim]')
    await sim.scrollIntoViewIfNeeded()
    check(await visible(p, '[data-sim] form'), 'シミュレーターの入力欄が出ない')
    check(!(await visible(p, '[data-sim-example]')), 'JS ありで例の説明が出ている')
    await p.locator('#sim-followers').fill('2000')
    await p.locator('#sim-posts').fill('5')
    await sim.locator('label', { hasText: 'パン屋' }).click()
    await p.waitForTimeout(900)
    const reach = await p.textContent('[data-result="reach"]')
    const time = await p.textContent('[data-result="time"]')
    // 2000 × 5 × 4.3 × 1.15 × 1.15 = 56,868 → 56,900 / 5 × 4.3 × 25 ÷ 60 = 8.958 → 9.0
    check(reach === '56,900' && time === '9.0', `シミュレーターの結果が違う: ${reach} / ${time}`)
    check((await p.textContent('[data-out="followers"]')) === '2,000 人', 'フォロワー数の表示が変わらない')
    check((await p.textContent('[data-sim-status]')).includes('56,900'), 'シミュレーターの読み上げ文が更新されない')
    // スライダー
    await p.locator('[data-slider]').scrollIntoViewIfNeeded()
    check((await p.getAttribute('[data-slider-prev]', 'aria-disabled')) === 'true', '最初の事例で「前へ」が aria-disabled でない')
    await p.click('[data-slider-next]')
    await p.waitForTimeout(900)
    check((await p.getAttribute('.p-cases__dots button:nth-child(2)', 'aria-current')) === 'true', '「次へ」で 2 件目に進まない')
    check(await p.locator('.p-case').nth(0).evaluate((el) => el.inert), '見えていない事例が inert にならない')
    await p.click('[data-slider-next]')
    await p.waitForTimeout(900)
    check((await p.getAttribute('[data-slider-next]', 'aria-disabled')) === 'true', '最後の事例で「次へ」が aria-disabled でない')
    check(await p.locator('[data-slider-next]').evaluate((el) => el === document.activeElement), '最後の事例まで進むと「次へ」からフォーカスが外れる')
    await p.click('[data-slider-next]', { force: true }) // aria-disabled のボタンは Playwright が押せないものとして扱うので force
    await p.waitForTimeout(500)
    check((await p.getAttribute('.p-cases__dots button:nth-child(3)', 'aria-current')) === 'true', '最後の事例で「次へ」を押すと位置が変わる')
    await p.click('.p-cases__dots button:nth-child(1)')
    await p.waitForTimeout(900)
    check((await p.getAttribute('.p-cases__dots button:nth-child(1)', 'aria-current')) === 'true', '点を押しても 1 件目に戻らない')
    // FAQ
    const faq2 = p.locator('.p-faq details').nth(1)
    await faq2.locator('summary').click()
    await p.waitForTimeout(500)
    check(await faq2.locator('.p-faq__a').isVisible(), 'FAQ を開いても答えが見えない')
    // 最初の画面の動きをまとめて止める
    const states = () => p.$$eval('.p-logos__track, .p-phone__feed, .p-devices__toast', (els) => els.map((e) => getComputedStyle(e).animationPlayState).join())
    await p.click('[data-motion-toggle]')
    check((await states()) === 'paused,paused,paused', `「動きを止める」で帯・投稿・通知が止まらない: ${await states()}`)
    await p.click('[data-motion-toggle]')
    check((await states()) === 'running,running,running', `「動きを再開する」で動き出さない: ${await states()}`)
    // カウントアップの最後の値
    await p.locator('.p-support').scrollIntoViewIfNeeded()
    await p.waitForTimeout(1800)
    const counts = await p.$$eval('[data-count]', (els) => els.map((e) => e.textContent))
    check(counts.join() === '4,800,97,98', `カウントアップの最後の値が違う: ${counts}`)
    await p.context().close()
  }

  // --- スマホ幅・動きを減らす設定でもお店の名前が全部見える ---
  {
    const p = await page({ reducedMotion: 'reduce' })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    const out = await p.$$eval('.p-logos__list:not([aria-hidden]) li', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth }).length)
    check(out === 0, `スマホ・動きを減らす設定でお店の名前が ${out} 件はみ出す`)
    await p.context().close()
  }

  // --- 個人情報のページからもモーダルが開く ---
  {
    const p = await page()
    await p.goto(base + 'privacy.html', { waitUntil: 'networkidle' })
    await p.click('.p-doc-text__link')
    await p.waitForTimeout(300)
    check((await dialogOpen(p)) && (await p.textContent('#signup-title')).includes('相談'), '個人情報のページでご相談のモーダルが開かない')
    await p.context().close()
  }

  // --- JavaScript なし ---
  {
    const p = await page({ javaScriptEnabled: false })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    const hidden = await p.$$eval('.u-reveal', (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length)
    check(hidden === 0, `JS なしで隠れたままの要素が ${hidden} 個`)
    check(!(await visible(p, '[role="tablist"]')), 'JS なしでタブ（動かない）が出ている')
    check((await p.locator('.p-usecase').evaluateAll((els) => els.filter((e) => e.checkVisibility()).length)) === 4, 'JS なしで 4 業種すべてが見えない')
    check(!(await visible(p, '[data-sim] form')) && (await visible(p, '[data-sim-example]')), 'JS なしでシミュレーターが例の結果だけにならない')
    check(!(await visible(p, '[data-slider-ctrl]')), 'JS なしでスライダーのボタン（動かない）が出ている')
    check(!(await visible(p, '[data-motion-toggle]')), 'JS なしで停止ボタン（動かない）が出ている')
    check((await p.locator('.p-logos__track').evaluate((el) => getComputedStyle(el).animationName)) === 'none', 'JS なしでお店の名前の帯が流れている（止められない）')
    // command 属性に対応したブラウザなら、JS なしでもモーダルが開く
    await p.setViewportSize({ width: 1440, height: 900 })
    await p.click('.l-header__actions [data-open="trial"]', { force: true })
    await p.waitForTimeout(300)
    check(await dialogOpen(p), 'JS なしで「無料で始める」のモーダルが開かない')
    check((await p.locator('[data-signup-form] button[type="submit"]').isDisabled()) && (await visible(p, '[data-nojs]')), 'JS なしで送信ボタンが押せる・案内が出ない')
    await p.context().close()
  }

  // --- 動きを減らす設定 ---
  {
    const p = await page({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    for (const sel of ['.p-logos__track', '.p-phone__feed', '.p-devices__toast'])
      check((await p.locator(sel).evaluate((el) => getComputedStyle(el).animationName)) === 'none', `動きを減らす設定で ${sel} が止まらない`)
    check((await p.locator('.p-phone__feed > *').count()) === 4, '動きを減らす設定で投稿が複製されている')
    check(!(await visible(p, '[data-motion-toggle]')), '動きを減らす設定で停止ボタンが出ている')
    // 帯は流さず、折り返して 10 店すべてが画面内に見える
    const out = await p.$$eval('.p-logos__list:not([aria-hidden]) li', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth }).length)
    check(out === 0, `動きを減らす設定でお店の名前が ${out} 件はみ出して見えない`)
    const counts = await p.$$eval('[data-count]', (els) => els.map((e) => e.textContent))
    check(counts.join() === '4,800,97,98', `動きを減らす設定で数字が最終値でない: ${counts}`)
    await p.context().close()
  }
  console.log('操作の確認: 完了')
}
