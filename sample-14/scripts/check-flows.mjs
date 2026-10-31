// 動く部品の確認（ビルド済みの dist/ を file:// で開いて確かめる）
//   npx vite build && npm run check [-- --shots <出力フォルダ>]
// 商品LP: メニューの絞り込み・くわしく、定期便／1回だけ、セットを選ぶ → フォーム、お届け日（7曜日を一覧表と照合）、
//         申し込みフォーム（エラー → 確認 → 修正 → 完了）、固定ボタン、JS なしの表示
// 記事LP: 3問の診断（3タイプとも出る）・比較表の色、商品LP へのリンク（UTM つき）
// 縦長画像: 5 枚が 750×1500 で読み込める
// 全ページ: 幅ごとのはみ出し・エラー・最初の画面の重なり
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const fileUrl = (p) => pathToFileURL(resolve('dist', p)).href
const shotsIndex = process.argv.indexOf('--shots')
const shotsDir = shotsIndex > -1 ? process.argv[shotsIndex + 1] : null
const results = []
const ok = (name, cond, detail = '') => results.push([cond ? 'OK ' : 'NG ', name, detail])

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())

const open = async (path, width = 1280, opts = {}) => {
  const page = await browser.newPage({ viewport: { width, height: 900 }, ...opts })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()))
  await page.goto(fileUrl(path), { waitUntil: 'load' })
  return { page, errors }
}

// ----- 幅ごとのはみ出し・エラー -----
for (const path of ['index.html', 'article.html', 'tall/index.html']) {
  for (const width of [360, 390, 768, 1024, 1280, 1440]) {
    const { page, errors } = await open(path, width)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ok(`${path} ${width}px はみ出しなし`, overflow <= 0, `${overflow}px`)
    ok(`${path} ${width}px エラーなし`, !errors.length, errors.join(' / '))
    if (path === 'index.html') {
      // 最初の画面: 見出しと写真が重ならない
      const overlap = await page.evaluate(() => {
        const a = document.querySelector('.p-hero__text').getBoundingClientRect()
        const b = document.querySelector('.p-hero__photo').getBoundingClientRect()
        return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
      })
      ok(`${path} ${width}px 最初の画面の文字と写真が重ならない`, !overlap)
      // お届け日の曜日ボタンが 1 行に収まる
      const rows = await page.evaluate(() => new Set([...document.querySelectorAll('.js-sched-days button')].map((b) => Math.round(b.getBoundingClientRect().top))).size)
      ok(`${path} ${width}px 曜日ボタンが1行`, rows === 1, `${rows}行`)
    }
    if (shotsDir) {
      await page.evaluate(() => document.querySelectorAll('.js-reveal').forEach((el) => el.classList.add('is-in')))
      await page.screenshot({ path: `${shotsDir}/${path.replace(/\W/g, '_')}-${width}.png`, fullPage: true })
    }
    await page.close()
  }
}

// ----- 商品LP の操作（PC 幅） -----
{
  const { page, errors } = await open('index.html')
  const visible = (sel) => page.locator(sel).filter({ visible: true }).count()

  // メニューの絞り込み
  await page.click('.js-menu-filter [data-filter="fish"]')
  ok('メニュー: 魚で2品', (await visible('.p-menu__card')) === 2)
  // 同じ文言でも読み上げられるよう、いったん空にしてから次のフレームで入れている
  await page.waitForFunction(() => /2品/.test(document.querySelector('.js-menu-status').textContent), null, { timeout: 2000 }).catch(() => {})
  ok('メニュー: 件数を読み上げ', /2品/.test(await page.textContent('.js-menu-status')))
  await page.click('.js-menu-filter [data-filter="all"]')
  ok('メニュー: すべてで4品', (await visible('.p-menu__card')) === 4)
  await page.click('.p-menu__card >> nth=0 >> summary')
  ok('メニュー: くわしくが開く', await page.locator('.p-menu__card >> nth=0 >> details').evaluate((d) => d.open))

  // 定期便／1回だけ
  const prices = () => page.$$eval('.js-set-price', (els) => els.map((e) => e.textContent).join('/'))
  ok('セット: 定期便の価格', (await prices()) === '2,480/4,680/7,200', await prices())
  await page.click('.js-set-mode [data-mode="one"]')
  ok('セット: 1回だけの価格', (await prices()) === '2,480/5,280/8,100', await prices())
  ok('セット: 1回だけで「定期」の文字が消える', (await page.textContent('.p-set[data-set="6"] h3')).trim() === '6食')
  ok('セット: 二重価格の根拠の注記がある', (await page.locator('.p-price-note').count()) >= 2)

  // セットを選ぶ → フォームに反映
  await page.click('[data-pick="10"]')
  const picked = await page.evaluate(() => {
    const f = document.querySelector('.js-entry-form').elements
    return `${f.set.value}/${f.mode.value}/${document.querySelector('.js-entry-total').textContent}`
  })
  ok('セットを選ぶ: フォームに 10食・1回だけ・8,100円', picked === '10/one/8,100', picked)
  await page.check('input[name="set"][value="trial"]')
  ok('フォーム: お試しは買い方を選べない', await page.locator('.js-entry-mode').evaluate((f) => f.disabled))
  ok('フォーム: お試しは 2,480円', (await page.textContent('.js-entry-total')) === '2,480')

  // お届け日: 7曜日すべてを一覧表と照合
  const table = await page.$$eval('.js-sched-table tbody tr', (rows) => rows.map((r) => r.querySelector('td').textContent.replace(/（.*/, '')))
  for (let i = 0; i < 7; i++) {
    await page.click(`.js-sched-days [data-d="${i}"]`)
    const text = await page.textContent('.js-sched-result')
    ok(`お届け日: ${'月火水木金土日'[i]}曜日の注文 → ${table[i]}`, text.includes(`${table[i]}にお届け`), text)
  }
  ok('お届け日: 操作できるときは一覧表を閉じる', !(await page.locator('.js-sched-table').evaluate((d) => d.open)))

  // 価格表の切り替えとフォームの買い方がそろう
  await page.check('input[name="set"][value="6"]')
  await page.click('.js-set-mode [data-mode="one"]')
  ok('同期: 価格表の「1回だけ」→ フォームも1回だけ', (await page.evaluate(() => document.querySelector('.js-entry-form').elements.mode.value)) === 'one')
  await page.check('input[name="mode"][value="sub"]')
  ok('同期: フォームの「定期便」→ 価格表も定期便', (await page.getAttribute('.js-set-mode [data-mode="sub"]', 'aria-pressed')) === 'true')

  // 申し込みフォーム
  await page.click('.js-entry-form [type="submit"]')
  ok('フォーム: 空で送ると5件のエラー', /5件/.test(await page.textContent('.js-entry-summary')))
  ok('フォーム: 最初のエラーにフォーカス', (await page.evaluate(() => document.activeElement.id)) === 'order-name')
  await page.fill('#order-zip', '12345')
  await page.locator('#order-zip').blur()
  ok('フォーム: 郵便番号の形のエラー', /7けた/.test(await page.textContent('#order-zip-error')))
  await page.fill('#order-name', '山田 花子')
  ok('フォーム: 直すとエラーが消える', (await page.textContent('#order-name-error')) === '')
  await page.fill('#order-zip', '１２３－４５６７')
  await page.fill('#order-tel', '090-1234-5678')
  await page.fill('#order-address', '東京都架空区1-2-3')
  await page.fill('#order-mail', 'hanako@example.jp')
  await page.fill('#order-kana', '<b>やまだ</b>')
  await page.click('.js-entry-form [type="submit"]')
  ok('フォーム: 確認画面が出る', await page.isVisible('.js-entry-confirm'))
  const list = await page.textContent('.js-entry-list')
  ok('確認: セットと金額', list.includes('6食（定期便）') && list.includes('4,680円'), list)
  ok('確認: 郵便番号・電話番号をそろえる', list.includes('〒123-4567') && list.includes('09012345678'))
  ok('確認: 入力したタグは文字のまま', list.includes('<b>やまだ</b>'))
  ok('確認: 見出しにフォーカス', (await page.evaluate(() => document.activeElement.tagName)) === 'H3')
  await page.click('.js-entry-back')
  ok('確認 → 修正で入力が残る', (await page.inputValue('#order-name')) === '山田 花子')
  await page.click('.js-entry-form [type="submit"]')
  await page.click('.js-entry-send')
  ok('フォーム: 完了画面が出る', await page.isVisible('.js-entry-done'))
  const events = await page.evaluate(() => window.dataLayer.map((e) => e.event).join(','))
  ok('計測: dataLayer に記録', events.includes('select_set') && events.includes('order_confirm') && events.includes('order_complete_demo'), events)
  await page.click('.js-entry-reset')
  ok('完了 → 入力画面に戻すと空', (await page.inputValue('#order-name')) === '' && (await page.textContent('.js-entry-total')) === '2,480')
  ok('完了 → 入力画面: お名前にフォーカス', (await page.evaluate(() => document.activeElement.id)) === 'order-name')
  ok('商品LP 操作中のエラーなし', !errors.length, errors.join(' / '))
  await page.close()
}

// ----- 固定ボタン（スマホ） -----
{
  const { page } = await open('index.html', 390)
  const hidden = () => page.locator('.js-fixbar').evaluate((el) => el.classList.contains('is-hidden'))
  ok('固定ボタン: 最初の画面では隠れる', await hidden())
  await page.evaluate(() => window.scrollTo(0, document.getElementById('menu').offsetTop))
  await page.waitForTimeout(400)
  ok('固定ボタン: 最初の画面を過ぎたら出る', !(await hidden()))
  await page.evaluate(() => window.scrollTo(0, document.getElementById('order').offsetTop))
  await page.waitForTimeout(400)
  ok('固定ボタン: 申し込み欄では隠れる', await hidden())
  await page.close()
}

// ----- JS なしの表示 -----
{
  const { page } = await open('index.html', 390, { javaScriptEnabled: false })
  ok('JS なし: お届け日の一覧表が開いている', await page.locator('.js-sched-table').evaluate((d) => d.open))
  ok('JS なし: 1回だけの価格を文で出す', await page.isVisible('.p-set__alt >> nth=0'))
  ok('JS なし: メニュー4品が見える', (await page.locator('.p-menu__card').filter({ visible: true }).count()) === 4)
  await page.close()
}

// ----- 記事LP -----
{
  const { page, errors } = await open('article.html', 390)
  const answer = async (a, b, c) => {
    for (const [q, i] of [['q1', a], ['q2', b], ['q3', c]]) await page.locator(`[name="${q}"]`).nth(i).check({ force: true })
    return {
      type: await page.textContent('.js-quiz-result b'),
      hit: await page.$$eval('.js-types .is-hit', (els) => [...new Set(els.map((e) => e.dataset.type))].join()),
    }
  }
  const r1 = await answer(0, 0, 0)
  const r2 = await answer(2, 2, 2)
  const r3 = await answer(1, 0, 1)
  ok('診断: 少しずつ定期型が出る', r1.type.includes('少しずつ定期型') && r1.hit === 'B', JSON.stringify(r1))
  ok('診断: まとめ買い型が出る', r2.type.includes('まとめ買い型') && r2.hit === 'A', JSON.stringify(r2))
  ok('診断: 主菜だけ型が出る', r3.type.includes('主菜だけ型') && r3.hit === 'C', JSON.stringify(r3))
  const bar = await page.textContent('.p-pr-bar')
  ok('記事: 【PR】と広告主の制作であることが最初に見える', bar.includes('【PR】') && bar.includes('広告主'))
  const href = await page.getAttribute('[data-cta="article"]', 'href')
  ok('記事: 商品LP へのリンクに UTM', href.includes('index.html?utm_source='), href)
  ok('記事LP エラーなし', !errors.length, errors.join(' / '))
  await page.close()
}

// ----- 縦長画像 -----
{
  const { page } = await open('tall/index.html')
  const sizes = await page.$$eval('.list img', (imgs) => imgs.map((i) => `${i.naturalWidth}x${i.naturalHeight}`))
  ok('縦長画像: 5枚とも 750x1500', sizes.length === 5 && sizes.every((s) => s === '750x1500'), sizes.join(' '))
  await page.close()
}

await browser.close()
for (const r of results) console.log(r.join(' ').trim())
const ng = results.filter((r) => r[0].startsWith('NG')).length
console.log(`\n${results.length - ng} / ${results.length} OK`)
process.exit(ng ? 1 : 0)
