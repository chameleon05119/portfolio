// SNS などでリンクを貼ったときのカード画像（public/og.jpg 1200x630）と
// ホーム画面用アイコン（public/apple-touch-icon.png 180x180）を作る
//   npm run og   … 作品を追加したら撮り直す（サムネイルが並ぶため）
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { works } from '../src/data/works.mjs';

const mark = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#16704b"/><path d="M27 24.5a7.5 7.5 0 1 1-7.5-7.5 4.5 4.5 0 1 1-4.5 4.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="27.5" cy="13.5" r="2.2" fill="#fff"/></svg>`;
const thumbs = await Promise.all(works.slice(0, 3).map(async (w) =>
  'data:image/jpeg;base64,' + (await readFile(new URL(`../src/assets/shots/${w.shot}/thumb.jpg`, import.meta.url))).toString('base64')));

const og = `<!doctype html><html lang="ja"><meta charset="utf-8"><style>
  body { margin:0; width:1200px; height:630px; overflow:hidden; font-family:"Hiragino Sans","Noto Sans JP",sans-serif; color:#1b2330;
    background:#f8f8f5; background-image:linear-gradient(rgb(27 35 48/.05) 1px,transparent 1px),linear-gradient(90deg,rgb(27 35 48/.05) 1px,transparent 1px); background-size:48px 48px; }
  .txt { position:absolute; left:80px; top:0; bottom:0; width:520px; display:flex; flex-direction:column; justify-content:center; }
  .txt svg { width:84px; height:84px; margin-bottom:28px; }
  h1 { font:700 60px/1.1 "Helvetica Neue",Arial,sans-serif; letter-spacing:-.01em; margin:0; }
  .ja { font-size:26px; font-weight:700; margin:14px 0 0; }
  .desc { font-size:24px; color:#5f6672; margin:28px 0 0; line-height:1.6; }
  .bar { display:inline-block; margin-top:28px; background:#16704b; color:#fff; font-size:20px; font-weight:700; padding:10px 22px; border-radius:99px; }
  .shots { position:absolute; right:-40px; top:70px; width:600px; height:520px; }
  .shots img { position:absolute; width:520px; border-radius:14px; box-shadow:0 2px 6px rgb(27 35 48/.1),0 24px 48px rgb(27 35 48/.16); border:6px solid #fff; }
  .shots img:nth-child(1) { left:0; top:0; transform:rotate(-4deg); }
  .shots img:nth-child(2) { left:70px; top:170px; transform:rotate(3deg); }
  .shots img:nth-child(3) { left:30px; top:300px; transform:rotate(-2deg); }
</style>
<div class="txt">${mark}<h1>Chameleon Works</h1><p class="ja">カメレオンワークス</p><p class="desc">Web コーディング・サイト制作の<br>作品集（ポートフォリオ）</p></div>
<div class="shots">${thumbs.map((t) => `<img src="${t}">`).join('')}</div>`;

const icon = `<!doctype html><style>html,body{margin:0;width:180px;height:180px;background:#16704b}svg{display:block}</style><svg width="180" height="180" viewBox="0 0 40 40"><path d="M27 24.5a7.5 7.5 0 1 1-7.5-7.5 4.5 4.5 0 1 1-4.5 4.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="27.5" cy="13.5" r="2.2" fill="#fff"/></svg>`;

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(og, { waitUntil: 'load' });
await page.screenshot({ path: new URL('../public/og.jpg', import.meta.url).pathname, type: 'jpeg', quality: 85 });
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(icon, { waitUntil: 'load' });
await page.screenshot({ path: new URL('../public/apple-touch-icon.png', import.meta.url).pathname });
await browser.close();
console.log('wrote public/og.jpg, public/apple-touch-icon.png');
