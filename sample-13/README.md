# sample-13 アンケート集計の自動化（Python）

形式のちがうアンケート回答（CSV・Excel）をまとめて、グラフ付きの Excel レポートと HTML のレポートにするツールです。
題材は架空の料理教室「キッチンスタジオ こむぎ」の 3 教室の体験レッスン アンケート。

## 使い方

```bash
uv sync                    # 初回だけ（Python 3.12 と openpyxl を入れる）
uv run survey-report       # config.toml を読んで out/report.xlsx・out/report.html を作る
uv run survey-report --config 別の設定.toml --out 出力先
uv run pytest -q           # テスト
```

教室ごとのファイルの場所・文字コード・見出しの行・見出しの言葉は `config.toml` に書きます。教室が増えたり質問文が変わったりしたら、`config.toml` だけを直します。

## 入力（`sample_data/`）

| 教室 | ファイル | 形式のばらつき |
|---|---|---|
| みなと教室 | `minato_google-form.csv` | Google フォームの CSV（UTF-8・BOM 付き）。満足度は「5 (とても満足)」、きっかけは複数選択 |
| さくら教室 | `sakura_handwritten.xlsx` | 手入力の Excel。1 行目にタイトル、見出しは 3 行目。年齢は数字、満足度に全角数字、再参加は ○ × △ |
| ひがし教室 | `higashi_paper.csv` | 紙のアンケートを打ち込んだ CSV（Shift_JIS）。満足度は言葉。空行・二重入力・範囲外の値・電話番号入りのご意見が混ざる |

サンプルは `uv run python scripts/make_sample_data.py` で作り直せます（乱数の種を固定しているので毎回同じ）。

## 出力

- `report.xlsx` … サマリー（教室別の表・きっかけ・年代、グラフ 3 つ）／回答一覧（フィルター付き）／自由記述（満足度の低い順）／要確認（集計から外した行と、集計に入れたが確かめてほしい行。理由・ファイル名・行番号つき）
- `report.html` … 同じ集計の要点を 1 枚に。メール添付やブラウザでの確認用

## しくみ

| ファイル | 役割 |
|---|---|
| `survey_report/config.py` | 設定ファイルを読む |
| `survey_report/load.py` | CSV・Excel を「見出し → 値」の行として読む |
| `survey_report/normalize.py` | 表記ゆれをそろえる。言いかえの表はファイルの先頭にある |
| `survey_report/aggregate.py` | 教室別・全体の数字を出す |
| `survey_report/report_xlsx.py` / `report_html.py` | レポートを書き出す |
| `scripts/build_site.py` | 作品集の紹介ページ（`site/`）を組み立てる |
| `scripts/ogp.mjs` | 紹介ページの OGP 画像を作る（portfolio のルートで `node sample-13/scripts/ogp.mjs`） |

## 作品集の紹介ページ

```bash
uv run python scripts/build_site.py   # site/ を作る（site_src/ に入力の表と設定を差し込む）
```

`site/` はコミットしておき、作品集の組み立て（`scripts/assemble.mjs`）ではそのままコピーします（GitHub Actions では Python を動かさない）。
Excel のサマリーの画像は macOS のクイックルック（`qlmanage`）で作るので、グラフは写りません。

## 読めなかったときの扱い

- 満足度が読めない・範囲外 … 集計から外す（推測で入れない）
- 年代・日付・「また参加したいか」が読めない … 「不明」「未回答」として集計に入れ、要確認に出す
- 直前の行とまったく同じ回答 … 二重入力の疑いとして要確認に出す（集計には入れる）
- ご意見の電話番号・メールアドレス … 要確認に出し、HTML レポートでは伏せ字にする
- 「=」「+」「-」「@」で始まるご意見 … Excel に数式ではなく文字として書く

## 注意

- お金の計算（料金・売上など）は扱っていません
- `uv sync` を `survey_report/` を作る前に実行していた場合は、`uv sync --reinstall-package survey-report` でコマンドを入れ直す
