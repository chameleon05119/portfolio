# sample-12 冬期講習の販促物一式（チラシ・説明資料・Meta 広告バナー）

架空の学習塾「個別指導 ことのは塾 さくら台校」の冬期講習に向けた販促物です。

| 制作物 | 原稿 | 書き出し（`src/public/out/`） |
|---|---|---|
| A4 両面チラシ | `src/flyer/index.html` | `flyer-print.pdf`（入稿用・塗り足し 3mm 込み 216×303mm）、`flyer-a4.pdf`（確認用）、`flyer-front.jpg` / `flyer-back.jpg` |
| 保護者説明会の資料（16:9・8 ページ） | `src/slides/index.html` | `slides.pdf`、`slide-1.jpg` 〜 `slide-8.jpg` |
| Meta 広告バナー（3 案 × 2 サイズ） | `src/banners/source.html` | `banner-{a,b,c}-{feed,story}.png`（1080×1080・1080×1920） |
| 紹介ページ | `src/index.html` | ― |

```bash
npm ci
npm run dev       # http://localhost:5173/ で原稿と紹介ページを確認
npm run export    # PDF・画像・OGP を書き出す（ビルド込み）
npm run build     # dist/ を作る（作品集の組み立てで使う）
node scripts/qr.mjs   # QR コード（src/assets/images/qr.svg）を作り直す
```

## 作り方のメモ

- 色・文字は `src/assets/css/tokens.css` に 1 か所でまとめ、チラシ・資料・バナー・紹介ページで共有する。文字・ボタンのオレンジは `--c-orange`（白文字・クリーム地とも 4.5:1 以上）、明るい `--c-orange-bright` は飾りだけに使う
- 架空のデモであることは、チラシ両面・資料の全ページ・バナー 6 枚・OGP 画像に入れる（画像だけ転載されても分かるように）
- チラシは mm・pt で組む。`.sheet` が塗り足し込み、`.trim` が仕上がり。文字は仕上がりの内側 10mm より内に置く
- 確認用 PDF は `html.is-trim` を付けて仕上がりの大きさで書き出す
- PDF は RGB。印刷所が CMYK・アウトライン化を求める場合は、入稿前にその指定に合わせる
- ストーリーズのバナーは上下 250px（アカウント名・返信欄が重なる範囲）に文字とボタンを置かない。`.bn__safe` の内側にだけ置く
- 原稿ページは印刷の大きさで組んでいるので、狭い画面では `src/public/fit.js` が画面幅に縮めて表示する（書き出しは広い画面で行うので影響しない）
- SVG の座標はカンマ区切りで書く。空白区切りで数字が長く続くと、pj-chameleon のカード番号ガードに誤って止められる

## 確認

```bash
npm run build
node <pj-chameleon>/30_engineering/tools/site-check/check.mjs http://localhost:4321/portfolio/sample-12/ --flows scripts/site-check.flows.mjs
```

フォント: Zen Maru Gothic・Noto Sans JP（Google Fonts）。写真は使わず、イラストは SVG。
