// sample-10 固有の操作の確認。30_engineering/tools/site-check/check.mjs の --flows に渡す
export default async ({ browser, base, check }) => {
  const page = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => check(false, `JS の例外（操作中）: ${e.message}`))
    return p
  }
  const visible = (p, sel) => p.locator(sel).first().isVisible()

  // --- リニューアル後（スマホ）: 固定バー → 予約フォームの入力チェック → 受付 ---
  {
    const p = await page()
    await p.goto(base + 'after/index.html', { waitUntil: 'networkidle' })
    check(!(await visible(p, '.l-header__nav')), 'スマホのヘッダーにナビが開いた状態で出ている')
    // メニュー: 開く → リンクで移動して閉じる
    await p.click('[data-menu-btn]')
    check(await visible(p, '.l-header__nav-cta'), 'メニューを開いても、予約ボタンが出ない')
    check((await p.getAttribute('[data-menu-btn]', 'aria-expanded')) === 'true', 'メニューを開いても aria-expanded が true にならない')
    await p.click('.l-header__nav a[href$="#faq"]')
    await p.waitForTimeout(900)
    check(!(await visible(p, '.l-header__nav')), 'メニューのリンクを押してもメニューが閉じない')
    const faqTop = await p.evaluate(() => document.getElementById('faq').getBoundingClientRect().top)
    check(faqTop >= 0 && faqTop < 140, `メニューから #faq に移動しない（top ${faqTop}）`)
    await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
    await p.waitForTimeout(300)
    const bar = p.locator('[data-bottom-bar]')
    check(!(await bar.evaluate((el) => el.classList.contains('is-shown'))), '電話・予約のバーが最初の画面で出ている')
    await p.evaluate(() => scrollTo({ top: 2500, behavior: 'instant' }))
    await p.waitForTimeout(500)
    check(await bar.evaluate((el) => el.classList.contains('is-shown') && !el.inert), '電話・予約のバーが最初の画面を過ぎても出ない')
    await bar.locator('.c-button').click()
    await p.waitForTimeout(900)
    check(await bar.evaluate((el) => !el.classList.contains('is-shown') && el.inert), '予約フォームが見えても電話・予約のバーが隠れない')

    // 空で送信 → エラー 4 件・最初の項目へフォーカス
    const submit = p.locator('[data-contact-form] button[type="submit"]')
    check(!(await submit.isDisabled()), '予約ボタンが押せないまま')
    await submit.click()
    const errs = await p.$$eval('[data-contact-form] .c-form__error', (els) => els.map((e) => e.textContent).filter(Boolean))
    check(errs.length === 4, `空で送信したときのエラーが 4 件でない: ${errs}`)
    check((await p.evaluate(() => document.activeElement.id)) === 'f-name', '空で送信したとき最初の項目にフォーカスしない')

    // 直すとその場でエラーが消える
    await p.fill('#f-name', '山田 花子')
    check((await p.textContent('#f-name-error')) === '', '入力してもお名前のエラーが消えない')
    await p.fill('#f-email', 'abc')
    await p.locator('#f-email').blur()
    check((await p.textContent('#f-email-error')).includes('形式'), 'メールの形式エラーが出ない')
    await p.fill('#f-email', 'hanako@example.jp')
    check((await p.textContent('#f-email-error')) === '', '正しいメールにしてもエラーが消えない')
    await p.locator('.c-chips label', { hasText: '開業' }).click()
    check((await p.textContent('#f-topic-error')) === '', '相談の内容を選んでもエラーが消えない')
    await p.locator('.c-form__agree input').check()
    await submit.click()
    check(await visible(p, '[data-contact-done]'), '送信しても受付のメッセージが出ない')
    check(!(await visible(p, '[data-contact-form]')), '送信してもフォームが残っている')
    check((await p.evaluate(() => document.activeElement.hasAttribute('data-contact-done'))), '受付のメッセージにフォーカスが移らない')

    // FAQ の開閉
    const faq = p.locator('.c-faq').first()
    await faq.locator('summary').click()
    await p.waitForTimeout(400)
    check(await faq.evaluate((d) => d.open), 'FAQ が開かない')
    await p.context().close()
  }

  // --- リニューアル後（PC）: ナビのページ内リンクがヘッダーに隠れない ---
  {
    const p = await page({ viewport: { width: 1440, height: 900 } })
    await p.goto(base + 'after/index.html', { waitUntil: 'networkidle' })
    for (const id of ['service', 'price', 'flow', 'faq', 'access']) {
      await p.locator(`.l-header__nav a[href$="#${id}"]`).click()
      await p.waitForTimeout(900)
      const top = await p.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, id)
      const header = await p.evaluate(() => document.querySelector('.l-header').getBoundingClientRect().bottom)
      check(top >= header - 2 && top < header + 60, `#${id} がヘッダーに隠れる・ずれる（top ${top} / header ${header}）`)
    }
    await p.context().close()
  }

  // --- 比較ページ: スライダーとタブ ---
  {
    const p = await page({ viewport: { width: 1280, height: 900 } })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    const range = p.locator('[data-slider] input[type="range"]')
    await range.focus()
    for (let i = 0; i < 2; i++) await p.keyboard.press('ArrowRight') // 5% ずつ動く
    check((await p.locator('[data-slider]').evaluate((el) => el.style.getPropertyValue('--pos'))) === '60%', 'キーボードでスライダーが動かない')
    await p.click('#tab-sp')
    check(await visible(p, '#panel-sp') && !(await visible(p, '#panel-pc')), 'スマホのタブに切り替わらない')
    await p.keyboard.press('ArrowLeft')
    check(await visible(p, '#panel-pc'), '左右キーでタブが切り替わらない')
    await p.context().close()
  }

  // --- JS が動かないとき: 予約ボタンは押せず、電話の案内が出る ---
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false })
    const p = await ctx.newPage()
    await p.goto(base + 'after/index.html')
    check(await p.locator('[data-contact-form] button[type="submit"]').isDisabled(), 'JS なしで予約ボタンが押せる')
    check(await visible(p, '[data-nojs]'), 'JS なしでフォームの案内が出ない')
    await ctx.close()
  }
}
