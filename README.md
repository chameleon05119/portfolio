# コーディング サンプル集

デザインカンプ（Figma）からのコーディングのサンプルです。いずれも練習用カンプを使った架空のサイトで、本文はダミーテキストです。

公開ページ: https://chameleon05119.github.io/portfolio/

| サンプル | 内容 | デザイン |
|---|---|---|
| [sample-01](sample-01/) 英会話スクール LP | HTML / SCSS（FLOCSS）/ JavaScript、レスポンシブ、CSS アニメーション、ハンバーガーメニュー | [Codejump](https://code-jump.com/xd-public/) 練習用デザインカンプ「⑰ 応用編：ランディングページ／CSSアニメーション」 |

## sample-01 の要点
- カンプとの差分を画像比較で確認（PC 1400px・SP 375px とも、ページの高さの差 ±1px 程度）
- Lighthouse（モバイル）: Performance 100 / Accessibility 95 / Best Practices 100
- 納品を想定し、ビルド結果は圧縮なし・固定ファイル名・相対パス（`index.html` を直接開いても動作）
- メニューはキーボード操作・スクリーンリーダーに対応（`aria-expanded`、背面の `inert`、Esc で閉じる）、`prefers-reduced-motion` でアニメーション停止
- 画像は WebP + `srcset` で出し分け

```bash
cd sample-01
npm install
npm run dev
```

デザインカンプのデータはこのリポジトリに含めていません（配布元の再配布禁止のため）。
