# カメレオンワークス — Web コーディング・サイト制作の作品集

公開ページ: https://chameleon05119.github.io/portfolio/

掲載している作品はすべて架空のサイトです。

## 作品

| 作品 | 内容 | ソース |
|---|---|---|
| 英会話スクール LP | デザインカンプ（Figma）からのコーディング（HTML / SCSS（FLOCSS）/ JavaScript）。カンプとの不一致率 PC 1.2%・スマホ 2.8%（高さの差 1px）、Lighthouse（モバイル）Performance 100 / Accessibility 95 / Best Practices 100 | [sample-01](sample-01/) |
| ベーカリーサイトのスマホ対応修正 | PC 向けの古いサイトを、PC の見た目を変えずにスマホ・タブレット対応。修正前後の比較つき報告書 | [sample-02](sample-02/) |

各作品のポイントは、公開ページの作品詳細に載せています。

## 構成

| パス | 内容 |
|---|---|
| `src/` | 作品集のトップと作品詳細ページ（Astro） |
| `src/data/works.mjs` | 掲載する作品のデータ。作品を追加するときはここに足す |
| `src/assets/shots/` | 作品のスクリーンショット（`npm run shots` で撮影） |
| `sample-01/` | 英会話スクール LP（Vite でビルド） |
| `sample-02/` | ベーカリーサイトの修正前・修正後・報告書（静的ファイル） |
| `scripts/assemble.mjs` | 作品集と各作品を 1 つのサイト（`_site/`）に組み立てる |

```bash
npm ci
npm run dev          # 作品集の開発サーバー
npm run build:all    # 公開用の _site/ を作る（GitHub Actions も同じ手順）
npm run shots        # 作品のスクリーンショットを撮り直す
```

`sample-02` の写真は Google の画像生成 AI（Gemini）で作成したものです。

`sample-01` のデザインカンプのデータは、配布元の規約によりこのリポジトリに含めていません（デザイン: [Codejump](https://code-jump.com/xd-public/) 練習用デザインカンプ「⑰ 応用編：ランディングページ／CSSアニメーション」）。
