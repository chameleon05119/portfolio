// sample-05 固有の操作の確認。30_engineering/tools/site-check/check.mjs の --flows に渡す
export default async ({ browser, base, check }) => {
  const page = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => check(false, `JS の例外（操作中）: ${e.message}`))
    return p
  }
  const visible = (p, sel) => p.locator(sel).first().isVisible()

  // --- LP（スマホ）: ヘッダー・追従ボタン ---
  {
    const p = await page()
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    check(!(await visible(p, '.l-header__nav')) && !(await visible(p, '.l-header__actions')), 'スマホのヘッダーにナビ・ボタンが出ている')
    const fix = p.locator('[data-fixed-cta]')
    check(!(await fix.evaluate((el) => el.classList.contains('is-shown'))), '追従ボタンが最初の画面で出ている')
    await p.evaluate(() => scrollTo({ top: 2500, behavior: 'instant' }))
    await p.waitForTimeout(500)
    check(await fix.evaluate((el) => el.classList.contains('is-shown') && !el.inert), '追従ボタンが最初の画面を過ぎても出ない')
    await p.locator('.c-cta').scrollIntoViewIfNeeded()
    await p.waitForTimeout(500)
    check(await fix.evaluate((el) => !el.classList.contains('is-shown') && el.inert), '最後の CTA が見えても追従ボタンが隠れない')
    // 追従ボタンの「無料でためす」→ フォームでご用件が「無料トライアル」
    await p.evaluate(() => scrollTo({ top: 2500, behavior: 'instant' }))
    await p.waitForTimeout(500)
    await fix.locator('a', { hasText: '無料でためす' }).click()
    await p.waitForLoadState('networkidle')
    check(p.url().includes('download.html?type=trial'), `追従ボタンの行き先が違う: ${p.url()}`)
    check((await p.evaluate(() => document.querySelector('[data-request-form]').elements.type.value)) === 'trial', '無料でためす から来てもご用件が無料トライアルにならない')
    await p.context().close()
  }

  // --- LP（PC）: ナビ・料金切り替え・FAQ・比較表・ロゴの帯・カウント ---
  {
    const p = await page({ viewport: { width: 1440, height: 900 } })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    for (const id of ['feature', 'case', 'price', 'faq']) {
      await p.locator(`.l-header__nav a[href="#${id}"]`).click()
      await p.waitForTimeout(900)
      const top = await p.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, id)
      const header = await p.evaluate(() => document.querySelector('.l-header').getBoundingClientRect().bottom)
      check(top >= header - 2 && top < 200, `ナビ「#${id}」で移動した先がヘッダーに隠れる・ずれる（top ${Math.round(top)}）`)
    }
    const nums = () => p.$$eval('.p-plan__num', (els) => els.map((e) => e.textContent))
    check((await nums()).join() === '980,1,980', `年払いの金額が違う: ${await nums()}`)
    await p.click('[data-billing="monthly"]')
    check((await nums()).join() === '1,200,2,400', `月払いに切り替わらない: ${await nums()}`)
    check((await p.textContent('[data-billing-status]')).includes('月払い'), '料金切り替えの読み上げ文が更新されない')
    check((await p.getAttribute('[data-billing="monthly"]', 'aria-pressed')) === 'true', '月払いボタンの aria-pressed が true にならない')
    await p.click('[data-billing="yearly"]')
    check((await nums()).join() === '980,1,980', '年払いに戻らない')
    const faq2 = p.locator('.p-faq details').nth(1)
    await faq2.locator('summary').click()
    await p.waitForTimeout(500)
    check(await faq2.evaluate((d) => d.open), 'FAQ が開かない')
    check(await faq2.locator('.p-faq__a').isVisible(), 'FAQ を開いても答えが見えない')
    await p.click('.p-compare summary')
    await p.waitForTimeout(300)
    check(await visible(p, '.p-compare table'), '比較表が開かない')
    await p.click('[data-marquee-toggle]')
    check((await p.locator('.p-logos__track').evaluate((el) => getComputedStyle(el).animationPlayState)) === 'paused', 'ロゴの帯が止まらない')
    await p.click('[data-marquee-toggle]')
    check((await p.locator('.p-logos__track').evaluate((el) => getComputedStyle(el).animationPlayState)) === 'running', 'ロゴの帯が動き出さない')
    await p.locator('.p-nums').scrollIntoViewIfNeeded()
    await p.waitForTimeout(1800)
    const counts = await p.$$eval('[data-count]', (els) => els.map((e) => e.textContent))
    check(counts.join() === '95,98', `カウントアップの最後の値が違う: ${counts}`)
    await p.context().close()
  }

  // --- フォーム ---
  {
    const p = await page()
    await p.goto(base + 'download.html', { waitUntil: 'networkidle' })
    const f = p.locator('[data-request-form]')
    check((await p.evaluate(() => document.querySelector('[data-request-form]').elements.type.value)) === 'download', '最初のご用件が資料ダウンロードでない')
    check((await p.textContent('[data-message-badge]')) === '任意', '資料ダウンロードのときご相談内容が任意でない')
    // 空で送信
    await f.locator('button[type="submit"]').click()
    check(await p.evaluate(() => document.activeElement?.classList.contains('p-form__summary')), '空で送信してもエラー一覧にフォーカスが移らない')
    const errs = await p.$$eval('.p-form__summary li', (li) => li.map((l) => l.dataset.for))
    check(errs.join() === 'company,name,email,size,agree', `エラー一覧が想定と違う: ${errs}`)
    // エラー一覧のリンクで項目へ移動
    await p.click('.p-form__summary a[href="#email"]')
    check(await p.evaluate(() => document.activeElement?.id === 'email' || location.hash === '#email'), 'エラー一覧のリンクで項目へ移動しない')
    // ご相談に切り替えると相談内容が必須に
    await p.check('input[name="type"][value="contact"]')
    check((await p.textContent('[data-message-badge]')) === '必須', 'ご相談にしても相談内容が必須にならない')
    // 形式エラー → 直すと消える
    await p.fill('#email', 'taro@')
    await p.locator('#company').focus()
    check((await p.textContent('#email-error')).includes('形式'), 'メールの形式エラーが出ない')
    await p.fill('#email', 'taro@example.co.jp')
    check((await p.textContent('#email-error')) === '', 'メールを直してもエラーが消えない')
    check(!(await p.$('.p-form__summary li[data-for="email"]')), '直した項目がエラー一覧から消えない')
    await p.fill('#tel', 'abc')
    await p.locator('#company').focus()
    check((await p.textContent('#tel-error')) !== '', '電話番号の形式エラーが出ない')
    await p.fill('#tel', '03-1234-5678')
    // 残りを入力して確認へ
    await p.fill('#company', 'テスト株式会社')
    await p.fill('#name', '山田 太郎')
    await p.selectOption('#size', { index: 2 })
    await p.fill('#message', '<img src=x onerror=alert(1)>20名で検討中')
    await p.check('#agree')
    await f.locator('button[type="submit"]').click()
    await p.waitForTimeout(600)
    check(await visible(p, '[data-step="confirm"]'), '確認画面に進まない')
    check((await p.getAttribute('.p-steps-bar li:nth-child(2)', 'aria-current')) === 'step', '手順の表示が「確認」にならない')
    const rows = await p.$$eval('.p-form__table td', (td) => td.map((t) => t.textContent))
    check(rows.includes('<img src=x onerror=alert(1)>20名で検討中') && !(await p.$('.p-form__table img')), '確認画面で入力内容が HTML として解釈されている')
    check(rows[0] === '導入のご相談・お問い合わせ' && rows.includes('テスト株式会社'), `確認画面の内容が違う: ${rows}`)
    // 修正する → 値が残る
    await p.click('[data-back]')
    check((await p.inputValue('#company')) === 'テスト株式会社' && (await visible(p, '[data-request-form]')), '修正するで入力画面に戻らない・値が消える')
    await f.locator('button[type="submit"]').click()
    await p.waitForTimeout(400)
    await p.click('[data-send]')
    await p.waitForLoadState('networkidle')
    check(p.url().endsWith('thanks.html'), `送信後に完了ページへ行かない: ${p.url()}`)
    check(!p.url().includes('example'), '入力内容が URL に載っている')
    // 資料 PDF
    const href = await p.getAttribute('a[download]', 'href')
    const pdf = await fetch(new URL(href, p.url()))
    check(pdf.status === 200 && (pdf.headers.get('content-type') || '').includes('pdf'), `資料 PDF が開けない: ${pdf.status} ${pdf.headers.get('content-type')}`)
    await p.context().close()
  }

  // --- ご用件のプリセット ---
  for (const [q, v] of [['?type=contact', 'contact'], ['?type=trial', 'trial'], ['?type=xxx', 'download']]) {
    const p = await page()
    await p.goto(base + 'download.html' + q, { waitUntil: 'networkidle' })
    check((await p.evaluate(() => document.querySelector('[data-request-form]').elements.type.value)) === v, `${q} でご用件が ${v} にならない`)
    await p.context().close()
  }

  // --- JavaScript なし ---
  {
    const p = await page({ javaScriptEnabled: false })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    const hidden = await p.$$eval('.u-reveal', (els) => els.filter((e) => getComputedStyle(e).opacity !== '1').length)
    check(hidden === 0, `JS なしで隠れたままの要素が ${hidden} 個`)
    check(!(await visible(p, '[data-billing-group]')), 'JS なしで料金の切り替えボタン（動かない）が出ている')
    check(!(await visible(p, '[data-marquee-toggle]')), 'JS なしでロゴの停止ボタン（動かない）が出ている')
    await p.goto(base + 'download.html', { waitUntil: 'networkidle' })
    check((await visible(p, '[data-no-js]')) && !(await visible(p, '[data-request-form]')), 'JS なしでフォームの案内が出ない')
    await p.context().close()
  }

  // --- 動きを減らす設定 ---
  {
    const p = await page({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    check((await p.locator('.p-logos__track').evaluate((el) => getComputedStyle(el).animationName)) === 'none', '動きを減らす設定でロゴの帯が止まらない')
    check((await p.locator('.p-app__wave span').first().evaluate((el) => getComputedStyle(el).animationName)) === 'none', '動きを減らす設定で波形が止まらない')
    check(!(await visible(p, '[data-marquee-toggle]')), '動きを減らす設定でロゴの停止ボタンが出ている')
    await p.locator('.p-nums').scrollIntoViewIfNeeded()
    const counts = await p.$$eval('[data-count]', (els) => els.map((e) => e.textContent))
    check(counts.join() === '95,98', `動きを減らす設定で数字が最終値でない: ${counts}`)
    await p.context().close()
  }
  console.log('操作の確認: 完了')
}
