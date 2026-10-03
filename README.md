# Web コーディング サンプル集

Web コーディング・修正のサンプルです。いずれも架空のサイトです。

公開ページ: https://chameleon05119.github.io/portfolio/

| サンプル | 内容 | デザイン |
|---|---|---|
| [sample-01](sample-01/) 英会話スクール LP | HTML / SCSS（FLOCSS）/ JavaScript、レスポンシブ、CSS アニメーション、ハンバーガーメニュー | [Codejump](https://code-jump.com/xd-public/) 練習用デザインカンプ「⑰ 応用編：ランディングページ／CSSアニメーション」 |
| [sample-02](sample-02/) 既存サイトのスマホ表示崩れ修正 | PC 向けの古いサイト（固定幅・float）を PC の見た目を変えずにスマホ・タブレット対応。修正前後の比較つき報告書 | 修正前のサイトは、よくある崩れを再現するために作成した架空のもの |

## sample-01 の要点
- カンプとの差分を画像比較で確認（PC 1400px・SP 375px とも、ページの高さの差 ±1px 程度）
- Lighthouse（モバイル）: Performance 100 / Accessibility 95 / Best Practices 100
- 納品を想定し、ビルド結果は圧縮なし・固定ファイル名・相対パス（`index.html` を直接開いても動作）
- メニューはキーボード操作・スクリーンリーダーに対応（`aria-expanded`、背面の `inert`、Esc で閉じる）、`prefers-reduced-motion` でアニメーション停止
- 画像は WebP + `srcset` で出し分け

## sample-02 の要点
- `sample-02/before` → `sample-02/after` の差分が修正内容（既存の CSS はほぼ触らず、末尾にスマホ・タブレット対応を追加）
- PC 幅（960〜1440px）のページ全体をピクセル比較し、意図した変更（長い URL の改行）以外の変化 0% を確認
- 修正報告書: `sample-02/report/`（症状・原因・修正内容と修正前後のスクリーンショット）

```bash
cd sample-01
npm install
npm run dev
```

デザインカンプのデータはこのリポジトリに含めていません（配布元の再配布禁止のため）。
