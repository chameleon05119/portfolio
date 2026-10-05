// クラウドワークスのポートフォリオに添付する画像（1200x800 JPG）を作る
//   node scripts/cw-images.mjs <出力フォルダ>
// PC とスマホの最初の画面を1枚に並べる。スマホ対応修正（s02）は修正前後のスマホを並べる
// 素材は src/assets/shots/（npm run shots で撮ったもの）。s02 の修正前だけはその場で撮る
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { works, SITE } from '../src/data/works.mjs';

const out = resolve(process.argv[2] ?? 'cw-images');
await mkdir(out, { recursive: true });

// プロフィール（pj-chameleon/10_sales/crowdworks-profile.md）の登録順と、画像に載せる一言
const order = [
  ['3-1', 's03', 'PC・スマホ対応'],
  ['3-2', 's04', 'PC・スマホ対応'],
  ['3-3', 's07', 'WordPress オリジナルテーマ'],
  ['3-4', 's05', 'PC・スマホ対応'],
  ['3-5', 's06', 'PC・スマホ対応'],
  ['3-6', 's01', 'Figma のデザインカンプからコーディング'],
  ['3-7', 's02', 'PC の見た目は変えずにスマホ表示を修正'],
];

const dataUrl = async (path) => 'data:image/jpeg;base64,' + (await readFile(path)).toString('base64');
const shot = (s, f) => new URL(`../src/assets/shots/${s}/${f}.jpg`, import.meta.url);

const css = `
  body { margin:0; width:1200px; height:800px; overflow:hidden; position:relative; font-family:"Hiragino Sans","Noto Sans JP",sans-serif; color:#1b2330;
    background:#f8f8f5; background-image:linear-gradient(rgb(27 35 48/.05) 1px,transparent 1px),linear-gradient(90deg,rgb(27 35 48/.05) 1px,transparent 1px); background-size:48px 48px; }
  .pc { position:absolute; left:56px; top:48px; width:860px; border-radius:12px; overflow:hidden; background:#fff; box-shadow:0 2px 6px rgb(27 35 48/.1),0 24px 48px rgb(27 35 48/.16); }
  .pc .bar { height:30px; background:#eceae4; display:flex; gap:7px; align-items:center; padding-left:14px; }
  .pc .bar i { width:11px; height:11px; border-radius:50%; background:#cfccc4; }
  .pc img { display:block; width:860px; height:537px; object-fit:cover; object-position:top; }
  .sp { position:absolute; width:250px; padding:10px; border-radius:36px; background:#fff; box-shadow:0 2px 6px rgb(27 35 48/.12),0 24px 48px rgb(27 35 48/.2); }
  .sp img { display:block; width:250px; height:541px; object-fit:cover; object-position:top; border-radius:26px; }
  .sp b { position:absolute; left:50%; top:-16px; transform:translateX(-50%); background:#1b2330; color:#fff; font-size:18px; padding:6px 18px; border-radius:99px; white-space:nowrap; }
  .sp.after b { background:#16704b; }
  .cap { position:absolute; left:56px; bottom:44px; }
  .cap h1 { margin:0; font-size:34px; line-height:1.3; }
  .cap p { margin:8px 0 0; font-size:20px; color:#5f6672; }
  .cap p span { display:inline-block; margin-right:10px; padding:3px 12px; border-radius:99px; background:#16704b; color:#fff; font-size:16px; font-weight:700; }
`;

const caption = (w, sub) => `<div class="cap"><h1>${w.name}</h1><p><span>${sub}</span>自主制作（架空のサイト）</p></div>`;

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());

// s02 の修正前（スマホ・最初の画面）を撮る
const spPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const spFirst = async (url) => {
  await spPage.goto(url, { waitUntil: 'networkidle' });
  await spPage.waitForTimeout(1000);
  return 'data:image/jpeg;base64,' + (await spPage.screenshot({ type: 'jpeg', quality: 85 })).toString('base64');
};

const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
for (const [no, s, sub] of order) {
  const w = works.find((x) => x.shot === s);
  let body;
  if (s === 's02') {
    const before = await spFirst(SITE + 'sample-02/before/');
    const after = await spFirst(SITE + 'sample-02/after/');
    body = `
      <div class="sp" style="left:250px;top:56px"><b>修正前</b><img src="${before}"></div>
      <div class="sp after" style="left:700px;top:56px"><b>修正後</b><img src="${after}"></div>
      <div style="position:absolute;left:560px;top:300px;font-size:64px;color:#16704b;font-weight:700">→</div>`;
    body += caption(w, sub);
    await page.setContent(`<!doctype html><html lang="ja"><meta charset="utf-8"><style>${css}</style>${body}`, { waitUntil: 'load' });
  } else {
    body = `
      <div class="pc"><div class="bar"><i></i><i></i><i></i></div><img src="${await dataUrl(shot(s, 'pc'))}"></div>
      <div class="sp" style="right:56px;top:150px"><img src="${await dataUrl(shot(s, 'sp'))}"></div>
      ${caption(w, sub)}`;
    await page.setContent(`<!doctype html><html lang="ja"><meta charset="utf-8"><style>${css}</style>${body}`, { waitUntil: 'load' });
  }
  const file = `${out}/${no}_${w.slug}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
  console.log('wrote', file);
}
await browser.close();
