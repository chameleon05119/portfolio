// 動く部品の確認（ビルド済みの dist/ を file:// で開いて確かめる）
//   npx vite build && node scripts/check-flows.mjs [--shots <出力フォルダ>]
// お悩みチェック・タブ（クリックと矢印キー）・給与の目安・先輩の声の送り・応募フォーム（エラー → 確認 → 修正 → 完了）
// ・スマホメニュー・固定ボタン・横のはみ出し・JS なしの表示を確かめる
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const url = pathToFileURL(resolve('dist/index.html')).href
const shotsIndex = process.argv.indexOf('--shots')
const shotsDir = shotsIndex > -1 ? process.argv[shotsIndex + 1] : null
const results = []
const ok = (name, cond, detail = '') => results.push([cond ? 'OK ' : 'NG ', name, detail])

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())

// ----- 幅ごとのはみ出し・エラー -----
for (const width of [360, 390, 768, 1024, 1280, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()))
  await page.goto(url, { waitUntil: 'load' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  // ほかの要素と重なっていないか（最初の画面の文字と写真）
  const overlap = await page.evaluate(() => {
    const a = document.querySelector('.p-hero__body').getBoundingClientRect()
    const b = document.querySelector('.p-hero__photos').getBoundingClientRect()
    return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
  })
  ok(`${width}px はみ出しなし`, overflow <= 0, `${overflow}px`)
  ok(`${width}px 最初の画面の文字と写真が重ならない`, !overlap)
  ok(`${width}px エラーなし`, !errors.length, errors.join(' / '))
  if (shotsDir) await page.evaluate(() => document.querySelectorAll('.js-reveal').forEach((el) => el.classList.add('is-in')))
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/full-${width}.png`, fullPage: true })
  await page.close()
}

// ----- 操作（PC 幅） -----
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(url, { waitUntil: 'load' })

  await page.click('.js-worry[data-target="ans-2"]')
  ok('お悩み: 押すと答えが光る', await page.locator('#ans-2.is-hit').count() === 1)
  ok('お悩み: 読み上げ用に「あてはまる：」が付く', (await page.textContent('#ans-2 a')).startsWith('あてはまる：'))
  await page.click('.js-worry[data-target="ans-2"]')
  ok('お悩み: もう一度押すと戻る', await page.locator('#ans-2.is-hit').count() === 0)

  await page.click('#day-tab-part')
  ok('1日の流れ: パートのタブ', await page.isVisible('#day-part') && !(await page.isVisible('#day-full')))
  await page.focus('#day-tab-part')
  await page.keyboard.press('ArrowRight')
  ok('1日の流れ: 矢印キーで次のタブ', (await page.evaluate(() => document.activeElement.id)) === 'day-tab-new' && (await page.isVisible('#day-new')))
  await page.keyboard.press('Home')
  ok('1日の流れ: Home で最初のタブ', await page.isVisible('#day-full'))

  await page.click('#req-tab-part')
  ok('募集要項: パートのタブ', await page.isVisible('#req-part') && !(await page.isVisible('#req-full')))

  const total = () => page.textContent('.js-sim-total')
  ok('給与: 最初は 33.9', (await total()) === '33.9', await total())
  // 募集要項の「月給31万〜35万円（訪問手当を含む）」と、手当を除いた範囲が一致するか
  await page.fill('#sim-oncall', '0')
  await page.click('.js-sim label:has(input[name="exp"][value="0"])')
  ok('給与: 常勤の最低（〜3年・オンコール0回）= 31.0（募集要項の下限）', (await total()) === '31.0', await total())
  await page.click('.js-sim label:has(input[name="exp"][value="2"])')
  ok('給与: 常勤の最高（10年〜・オンコール0回）= 35.0（募集要項の上限）', (await total()) === '35.0', await total())
  await page.click('.js-sim label:has(input[name="exp"][value="1"])')
  await page.fill('#sim-oncall', '2')
  ok('給与: パートの日数は週3日から（募集要項と同じ）', (await page.getAttribute('#sim-days', 'min')) === '3')
  await page.click('.js-sim label:has(input[value="part"])')
  ok('給与: パートで日数が出る', await page.isVisible('.js-sim-days'))
  ok('給与: パート週3日 = 17.3', (await total()) === '17.3', await total())
  await page.fill('#sim-days', '5')
  ok('給与: 週5日で増える', Number(await total()) > 17.3, await total())
  await page.click('.js-sim-go')
  ok('給与: 条件がフォームに入る', (await page.inputValue('#entry-msg')).startsWith('給与の目安の条件：パート週5日'))

  const scrollLeft = () => page.evaluate(() => document.querySelector('.js-voices-list').scrollLeft)
  ok('先輩の声: 最初は「前へ」が押せない', (await page.getAttribute('.js-voices-prev', 'aria-disabled')) === 'true')
  await page.click('.js-voices-next')
  await page.waitForTimeout(700)
  ok('先輩の声: 「次へ」で送れる', (await scrollLeft()) > 0)

  // 応募フォーム
  await page.click('.js-entry-form [type="submit"]')
  ok('フォーム: 空で送るとお名前にエラー', (await page.textContent('#entry-name-error')).includes('お名前'))
  ok('フォーム: 最初のエラーにフォーカス', (await page.evaluate(() => document.activeElement.id)) === 'entry-name')
  ok('フォーム: エラーの件数を出す', (await page.textContent('.js-entry-summary')) === '2件の入力を確認してください')
  await page.fill('#entry-name', '架空 花子')
  ok('フォーム: 直したらエラーが消える', (await page.textContent('#entry-name-error')) === '')
  await page.fill('#entry-tel', '12345')
  await page.click('.js-entry-form [type="submit"]')
  ok('フォーム: 電話番号の形のエラー', (await page.textContent('#entry-tel-error')).includes('10〜11けた'))
  await page.fill('#entry-tel', '０９０－１２３４－５６７８')
  await page.fill('#entry-msg', '<b>タグ</b>のテスト')
  await page.click('.js-entry-form [type="submit"]')
  ok('フォーム: 確認画面', await page.isVisible('.js-entry-confirm'))
  ok('フォーム: 全角の電話番号を半角にそろえる', (await page.textContent('.js-entry-list')).includes('09012345678'))
  ok('フォーム: 入力がタグとして解釈されない', (await page.locator('.js-entry-list b').count()) === 0)
  ok('フォーム: 手順が「確認」', (await page.textContent('.js-entry-steps [aria-current="step"]')) === '確認')
  await page.click('.js-entry-back')
  ok('フォーム: 修正で入力が残る', (await page.inputValue('#entry-name')) === '架空 花子')
  await page.click('.js-entry-form [type="submit"]')
  await page.click('.js-entry-send')
  ok('フォーム: 完了画面', await page.isVisible('.js-entry-done'))
  ok('フォーム: 完了の見出しにフォーカス', await page.evaluate(() => document.activeElement.closest('.js-entry-done') !== null))
  ok('フォーム: 完了した手順に「済み」が付く', (await page.textContent('.js-entry-steps li:first-child')).includes('済み'))
  await page.click('.js-sim-go')
  ok('給与 → フォーム: 完了画面のときは入力画面に戻して条件を入れる', (await page.isVisible('.js-entry-form')) && (await page.inputValue('#entry-msg')).startsWith('給与の目安の条件'))
  await page.click('.js-entry-form [type="submit"]')
  await page.click('.js-entry-send')
  await page.click('.js-entry-reset')
  ok('フォーム: 「入力画面に戻る」で空の入力画面', (await page.isVisible('.js-entry-form')) && (await page.inputValue('#entry-name')) === '')
  await page.close()
}

// ----- スマホ: メニュー・固定ボタン -----
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  await page.goto(url, { waitUntil: 'load' })
  ok('スマホ: 固定ボタンが見える', await page.isVisible('.js-fixbar'))
  await page.click('.js-menu-open')
  ok('スマホ: メニューが開く', await page.isVisible('.js-menu'))
  await page.click('.js-menu-close')
  ok('スマホ: 閉じるとボタンにフォーカスが戻る', await page.evaluate(() => document.activeElement.classList.contains('js-menu-open')))
  await page.click('.js-menu-open')
  await page.click('.js-menu a[href="#faq"]')
  await page.waitForTimeout(2000) // なめらかなスクロールが終わるまで待つ
  ok('スマホ: メニューで移動したら移動先にフォーカス', await page.evaluate(() => document.activeElement.id === 'faq'))
  ok('スマホ: メニューのリンクで移動して閉じる', !(await page.isVisible('.js-menu')) && (await page.evaluate(() => document.getElementById('faq').getBoundingClientRect().top < 200)))
  await page.evaluate(() => document.getElementById('entry').scrollIntoView({ behavior: 'instant' }))
  await page.waitForTimeout(500)
  ok('スマホ: フォームが見えたら固定ボタンを隠す', await page.locator('.js-fixbar.is-hidden').count() === 1)
  await page.close()
}

// ----- JS なし -----
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'load' })
  ok('JSなし: 1日の流れが3つとも見える', (await page.isVisible('#day-full')) && (await page.isVisible('#day-part')) && (await page.isVisible('#day-new')))
  ok('JSなし: 募集要項が2つとも見える', (await page.isVisible('#req-full')) && (await page.isVisible('#req-part')))
  ok('JSなし: タブの列は出さない', !(await page.isVisible('#day-tab-full')))
  ok('JSなし: 送信ボタンは押せない', await page.isDisabled('.js-entry-form [type="submit"]'))
  ok('JSなし: 文章が隠れていない', (await page.evaluate(() => getComputedStyle(document.querySelector('.js-reveal')).opacity)) === '1')
  await ctx.close()
}

await browser.close()
for (const r of results) console.log(r.join(' '))
const ng = results.filter((r) => r[0].startsWith('NG')).length
console.log(`\n${results.length - ng}/${results.length} OK`)
process.exit(ng ? 1 : 0)
