# sample-14：商品LP＋記事LP＋縦長LP画像（ことこと膳）

架空の冷凍の宅配おかず「ことこと膳」の、広告から申し込みまでの流れです。構成・デザインからコーディングまで自作しました。

| ページ | 内容 |
|---|---|
| `src/article.html` | 記事LP（架空の情報サイト「くらしの献立メモ」の比較・選び方記事）。【PR】表記、3問のタイプ診断と比較表の色、商品LP へのリンク（UTM つき） |
| `src/index.html` | 商品LP（お試し4食）。メニューの絞り込み、定期便／1回だけの価格切り替え、注文曜日でお届け日が変わる表、入力 → 確認 → 完了の申し込みフォーム（送信しない） |
| `src/tall/` | 縦長LP画像（楽天・広告用、幅 750px × 高さ 1,500px の 5 枚）。`source.html` が元データ、`index.html` が一覧 |

価格・数値・お客様の声はすべて架空です。写真は Pexels（`src/assets/images/SOURCES.md`）。

## 使い方

```bash
npm ci
npm run dev       # 開発サーバー
npm run build     # dist/ に書き出し（圧縮しない・ファイル名固定。納品先で手直ししやすいように）
npm run photos    # 写真の原本（src/assets/images/source/）から WebP の幅違いと OGP 画像を作る
npm run tall      # 縦長LP画像を src/public/tall/ に PNG で書き出す（ビルド → 撮影 → ビルド）
npm run check     # 動く部品の確認（先に build。93 項目）
```

## 作りのメモ

- CSS は FLOCSS。色・書体・角丸は `src/assets/scss/foundation/_tokens.scss`（デザインの A案「生成りテラコッタ」）
- JS は `src/public/assets/js/main.js`（ビルドせずコピー。file:// でも動く）。機能ごとに関数を分け、対象の要素がないページでは何もしない
- JS が動かないときも内容は読める（メニューは全部表示、お届け日は一覧表が開く、1回だけの価格は文で出す）
- 計測は GTM がある想定で `window.dataLayer` に `select_set`・`order_confirm`・`order_complete_demo`・`quiz_result`・`cta_click` を積むだけ（デモでは送信先なし）
- 縦長画像は商品LP と同じ文言・写真。価格を直すときは `src/tall/source.html` を直して `npm run tall`
