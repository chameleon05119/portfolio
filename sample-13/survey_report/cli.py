"""コマンドの入口。

    uv run survey-report                      # config.toml を読んで out/ に書き出す
    uv run survey-report --config 別の設定.toml --out 出力先
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .aggregate import by_source
from .config import ConfigError, load_config
from .load import LoadError, read_source
from .normalize import normalize
from .report_html import write_html
from .report_xlsx import write_xlsx


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="survey-report", description="アンケートの回答ファイルをまとめて、Excel と HTML のレポートを作る")
    p.add_argument("--config", type=Path, default=Path("config.toml"), help="設定ファイル（既定: config.toml）")
    p.add_argument("--out", type=Path, default=Path("out"), help="出力先のフォルダ（既定: out）")
    args = p.parse_args(argv)

    try:
        cfg = load_config(args.config)
        rows = [r for src in cfg.sources for r in read_source(src)]
    except (ConfigError, LoadError) as e:
        print(f"エラー: {e}", file=sys.stderr)
        return 1

    result = normalize(rows, cfg.year, cfg.month)
    groups = by_source(result.responses, [s.name for s in cfg.sources])
    xlsx = args.out / "report.xlsx"
    html = args.out / "report.html"
    try:
        write_xlsx(xlsx, cfg, groups, result)
        write_html(html, cfg, groups, result)
    except PermissionError:
        print(f"エラー: {args.out} に書き込めません。report.xlsx を Excel で開いている場合は閉じてから、もう一度実行してください", file=sys.stderr)
        return 1

    for g in groups:
        avg = "—" if g.average is None else f"{g.average:.1f}"
        print(f"{g.name:　<6} 回答 {g.count:>3} 件　満足度 {avg}")
    print(f"集計から外した行 {len(result.excluded)} 件・要確認 {len(result.issues)} 件・空行 {result.blank_rows} 行（Excel の「要確認」シート）")
    print(f"書き出し: {xlsx} / {html}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
