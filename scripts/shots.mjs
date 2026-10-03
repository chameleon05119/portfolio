// 作品のスクリーンショットを撮る（PC・スマホの全体、カード用のサムネイル）
//   npm run shots                 … 全作品
//   npm run shots -- english-school-lp   … 指定した作品だけ
//   SHOT_BASE=http://localhost:4321/portfolio/ npm run shots … 公開前の作品をローカルから撮る
// 出力: src/assets/shots/<shot>/{pc,sp,thumb}.jpg（git に入れる）
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { works, SITE } from '../src/data/works.mjs';

const only = process.argv.slice(2);
const base = process.env.SHOT_BASE;
const targets = works.filter((w) => !only.length || only.includes(w.slug));

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());

// アニメーションで隠れている要素を出すため、下まで少しずつスクロールしてから上に戻す
async function settle(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 300) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);
}

for (const w of targets) {
  const url = base ? w.url.replace(SITE, base) : w.url;
  const dir = new URL(`../src/assets/shots/${w.shot}/`, import.meta.url);
  await mkdir(dir, { recursive: true });

  const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await pc.goto(url, { waitUntil: 'networkidle' });
  await settle(pc);
  await pc.screenshot({ path: new URL('thumb.jpg', dir).pathname, type: 'jpeg', quality: 80 });
  await pc.screenshot({ path: new URL('pc.jpg', dir).pathname, type: 'jpeg', quality: 80, fullPage: true });

  const sp = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sp.goto(url, { waitUntil: 'networkidle' });
  await settle(sp);
  await sp.screenshot({ path: new URL('sp.jpg', dir).pathname, type: 'jpeg', quality: 80, fullPage: true });

  console.log('shot', w.slug, url);
  await pc.close();
  await sp.close();
}
await browser.close();
