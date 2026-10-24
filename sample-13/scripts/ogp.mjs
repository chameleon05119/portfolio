// SNS でシェアされたときの画像（site_src/ogp.png 1200×630）を作る
//   node sample-13/scripts/ogp.mjs   … portfolio のルートで実行する（ルートの playwright を使う）
// 先に scripts/build_site.py を実行して site/files/report-summary.png を作っておく
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const dir = new URL('../', import.meta.url)
const shot = 'data:image/png;base64,' + (await readFile(new URL('site/files/report-summary.png', dir))).toString('base64')
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><style>
  body { margin:0; width:1200px; height:630px; overflow:hidden; background:#2f6b5a; color:#fff; font-family:"Hiragino Sans","Noto Sans JP",sans-serif; }
  .t { position:absolute; left:64px; top:72px; width:520px; }
  .e { margin:0; font-size:22px; font-weight:700; opacity:.85; letter-spacing:.06em; }
  h1 { margin:16px 0 0; font-size:46px; line-height:1.4; }
  .chips { display:flex; flex-wrap:wrap; gap:10px; margin-top:28px; }
  .chips span { padding:6px 16px; border-radius:99px; background:rgba(255,255,255,.15); font-size:20px; font-weight:700; }
  img { position:absolute; left:620px; top:60px; width:640px; border-radius:12px; box-shadow:0 24px 48px rgba(0,0,0,.3); border:6px solid #fff; }
</style><div class="t"><p class="e">業務の自動化 ／ Python</p><h1>ばらばらな CSV・Excel を、コマンド 1 つで Excel レポートに</h1>
<div class="chips"><span>表記ゆれの統一</span><span>要確認の書き出し</span><span>グラフ付き</span></div></div><img src="${shot}">`

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'load' })
await page.screenshot({ path: new URL('site_src/ogp.png', dir).pathname })
await browser.close()
console.log('sample-13/site_src/ogp.png')
