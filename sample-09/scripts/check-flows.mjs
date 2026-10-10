// sample-09 固有の操作の確認。30_engineering/tools/site-check/check.mjs の --flows に渡す
// 計測（dataLayer に送るイベント）も、ここで名前とパラメータを確かめる
export default async ({ browser, base, check }) => {
  const page = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => check(false, `JS の例外（操作中）: ${e.message}`))
    return p
  }
  const visible = (p, sel) => p.locator(sel).first().isVisible()
  const events = (p, name) => p.evaluate((name) => window.dataLayer.filter((d) => d.event === name), name)

  // --- LP（スマホ）: 追従ボタン → フォーム → 完了ページのコンバージョン ---
  {
    const p = await page()
    await p.goto(base + 'index.html?utm_source=instagram&utm_medium=paid_social&utm_campaign=test&utm_content=a-1080x1080', { waitUntil: 'networkidle' })
    check(!(await visible(p, '.l-header__nav')) && !(await visible(p, '.l-header__actions')), 'スマホのヘッダーにナビ・ボタンが出ている')
    // キャンペーンの締切が日付になり、残り日数が出る
    check(/\d+月\d+日/.test(await p.textContent('.p-fv__campaign [data-deadline-text]')), 'キャンペーンの締切が日付にならない')
    check(await visible(p, '[data-deadline-left]'), '締切までの残り日数が出ない')

    const fix = p.locator('[data-fixed-cta]')
    check(!(await fix.evaluate((el) => el.classList.contains('is-shown'))), '追従ボタンが最初の画面で出ている')
    await p.evaluate(() => scrollTo({ top: 2500, behavior: 'instant' }))
    await p.waitForTimeout(500)
    check(await fix.evaluate((el) => el.classList.contains('is-shown') && !el.inert), '追従ボタンが最初の画面を過ぎても出ない')
    check((await events(p, 'section_view')).length >= 2, 'スクロールしても section_view が送られない')

    await fix.locator('[data-cta]').click()
    await p.waitForTimeout(900)
    const cta = await events(p, 'cta_click')
    check(cta.length === 1 && cta[0].cta_position === 'fixed', `追従ボタンの cta_click が正しくない: ${JSON.stringify(cta)}`)
    check(await fix.evaluate((el) => !el.classList.contains('is-shown') && el.inert), 'フォームが見えても追従ボタンが隠れない')

    // 空で送信 → エラー・最初の項目へのフォーカス・form_error
    const submit = p.locator('[data-trial-form] button[type="submit"]')
    check(!(await submit.isDisabled()), '送信ボタンが押せないまま')
    await submit.click()
    const errs = await p.$$eval('[data-trial-form] .c-form__error', (els) => els.map((e) => e.textContent).filter(Boolean))
    check(errs.length === 4, `空で送信したときのエラーが 4 件でない: ${errs}`)
    check((await p.evaluate(() => document.activeElement.id)) === 'f-name', '空で送信したとき最初の項目にフォーカスしない')
    const fe = await events(p, 'form_error')
    check(fe.length === 1 && fe[0].error_fields === 'name,email,level,agree', `form_error が正しくない: ${JSON.stringify(fe)}`)
    check((await events(p, 'form_start')).length === 1, 'form_start が 1 回だけ送られない')

    // 直すとその場でエラーが消える
    await p.fill('#f-name', '山田 花子')
    check((await p.textContent('#f-name-error')) === '', '入力してもお名前のエラーが消えない')
    await p.fill('#f-email', 'abc')
    await p.locator('#f-email').blur()
    check((await p.textContent('#f-email-error')).includes('形式'), 'メールの形式エラーが出ない')
    await p.fill('#f-email', 'hanako@example.jp')
    check((await p.textContent('#f-email-error')) === '', '正しいメールにしてもエラーが消えない')
    await p.locator('.p-trial .c-chips label', { hasText: '2級' }).first().click()
    check((await p.textContent('#f-level-error')) === '', '級を選んでもエラーが消えない')
    await p.locator('.c-form__agree input').check()
    // 入力した内容（名前・メール）が dataLayer に入っていない
    check(!(await p.evaluate(() => JSON.stringify(window.dataLayer).includes('example.jp'))), 'dataLayer にメールアドレスが入っている')

    await Promise.all([p.waitForURL(/thanks\.html$/), submit.click()])
    await p.waitForLoadState('networkidle')
    const lead = await events(p, 'generate_lead')
    check(
      lead.length === 1 && lead[0].course_level === '2' && lead[0].utm_source === 'instagram' && lead[0].utm_content === 'a-1080x1080',
      `完了ページの generate_lead が正しくない: ${JSON.stringify(lead)}`,
    )
    check((await p.textContent('[data-thanks-level-name]')) === '2級', '完了ページに選んだ級が出ない')
    // 再読み込みでは二重に数えない
    await p.reload({ waitUntil: 'networkidle' })
    check((await events(p, 'generate_lead')).length === 0, '完了ページを再読み込みすると generate_lead がもう一度送られる')
    check(!(await visible(p, '[data-thanks-level]')), '再読み込みしたのに級の案内が出ている')
    await p.context().close()
  }

  // --- LP（PC）: ナビ・受講料のボタン・学習プラン・FAQ・計測の確認モード ---
  {
    const p = await page({ viewport: { width: 1440, height: 900 } })
    await p.goto(base + 'index.html?debug=1', { waitUntil: 'networkidle' })
    check(await visible(p, '.p-debug'), '?debug=1 で計測の確認パネルが出ない')
    for (const id of ['feature', 'plan', 'price', 'faq']) {
      await p.locator(`.l-header__nav a[href$="#${id}"]`).click()
      await p.waitForTimeout(900)
      const top = await p.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, id)
      const header = await p.evaluate(() => document.querySelector('.l-header').getBoundingClientRect().bottom)
      check(top >= header - 2 && top < header + 60, `#${id} がヘッダーに隠れる・ずれる（top ${top} / header ${header}）`)
    }

    // 受講料のボタンで、フォームの級が選ばれる
    await p.locator('.p-price [data-plan="3-2"]').click()
    await p.waitForTimeout(900)
    check(await p.isChecked('#trial-form input[name="level"][value="3-2"]'), '受講料のボタンで級が選ばれない')
    const plan = await events(p, 'plan_select')
    check(plan.length === 1 && plan[0].course_level === '3-2', `plan_select が正しくない: ${JSON.stringify(plan)}`)
    check((await p.locator('.p-debug__item').count()) > 0, '確認パネルにイベントが出ない')

    // 学習プラン: 3級・60分・週7日 → 40時間 ÷ 7時間 = 6 週間
    await p.locator('#plan').scrollIntoViewIfNeeded()
    await p.locator('.p-plan .c-chips label', { hasText: /^3級$/ }).click()
    await p.locator('#plan-min').fill('60')
    await p.locator('#plan-days').fill('7')
    check((await p.textContent('[data-result="weeks"]')) === '6', `学習プランの週数が正しくない: ${await p.textContent('[data-result="weeks"]')}`)
    check((await p.textContent('[data-out="min"]')) === '60 分', '1日の学習時間の表示が変わらない')
    await p.waitForTimeout(1500)
    const sim = await events(p, 'plan_simulate')
    check(sim.length === 1 && sim[0].weeks === 6, `plan_simulate が操作のあと 1 回だけ送られない: ${JSON.stringify(sim)}`)
    check((await p.textContent('[data-plan-status]')).includes('6 週間'), '学習プランの結果が読み上げ用に伝わらない')

    // FAQ の開閉と計測
    const faq = p.locator('.c-faq').first()
    await faq.locator('summary').click()
    await p.waitForTimeout(400)
    check(await faq.evaluate((d) => d.open), 'FAQ が開かない')
    await faq.locator('summary').click()
    await p.waitForTimeout(400)
    check(!(await faq.evaluate((d) => d.open)), 'FAQ が閉じない')
    check((await events(p, 'faq_open')).length === 1, 'faq_open が開いたときだけ 1 回送られない')

    // 確認モードを終える
    await p.click('[data-debug-off]')
    await p.reload({ waitUntil: 'networkidle' })
    check(!(await visible(p, '.p-debug')), '確認モードを終了しても、再読み込みでまたパネルが出る')
    await p.context().close()
  }

  // --- 締切を過ぎたら、キャンペーンの表示を消して通常価格に戻る ---
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const p = await ctx.newPage()
    // 締切（今月末）の翌月 1 日として開く代わりに、締切に過去の日時を入れて確かめる
    await p.route('**/index.html', async (route) => {
      const res = await route.fetch()
      const body = (await res.text()).replace('data-deadline="month-end"', 'data-deadline="2020-01-31T23:59:59+09:00"')
      await route.fulfill({ response: res, body })
    })
    await p.goto(base + 'index.html', { waitUntil: 'networkidle' })
    check(!(await visible(p, '[data-campaign]')), '締切を過ぎてもキャンペーンの帯が出ている')
    check(!(await visible(p, '.p-price [data-campaign-only]')), '締切を過ぎても通常価格の打ち消し線が出ている')
    check((await p.textContent('[data-price="7840"]')) === '9,800', '締切を過ぎても 3級がキャンペーン価格のまま')
    await ctx.close()
  }

  // --- JS が動かないとき: 学習プランは例の結果を見せ、送信ボタンは押せない ---
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false })
    const p = await ctx.newPage()
    await p.goto(base + 'index.html')
    check(await visible(p, '[data-plan-example]'), 'JS なしで学習プランの例が出ない')
    check(await p.locator('[data-trial-form] button[type="submit"]').isDisabled(), 'JS なしで送信ボタンが押せる')
    check(await visible(p, '.c-form__nojs'), 'JS なしでフォームの案内が出ない')
    await ctx.close()
  }
}
