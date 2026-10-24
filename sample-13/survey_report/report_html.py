"""同じ集計を 1 枚の HTML にする（Excel を開かずにブラウザやメールで見られるように）。

メールで回すことを考えて、ご意見の中の電話番号・メールアドレスらしき部分は伏せ字にする。
"""

from __future__ import annotations

from datetime import date
from html import escape
from pathlib import Path

from .aggregate import Group
from .config import Config
from .normalize import CHANNELS, Result, mask_personal

CSS = """
*{box-sizing:border-box}body{margin:0;background:#f6f8f7;color:#23302b;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;line-height:1.7;font-feature-settings:'palt'}
main{max-width:960px;margin:0 auto;padding:32px 20px 48px}h1{margin:0;font-size:24px;color:#2f6b5a}h2{margin:36px 0 12px;font-size:18px}
.meta{margin:6px 0 0;color:#56655e;font-size:14px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:20px}
.kpi{margin:0;padding:14px 16px;border-radius:12px;background:#fff;box-shadow:0 0 0 1px #dbe4e0}.kpi b{display:block;font-size:26px;color:#2f6b5a;line-height:1.3}.kpi span{font-size:13px;color:#56655e}
.kpi--warn b{color:#a8460f}table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px #dbe4e0;font-size:14px}
th,td{padding:8px 12px;border-bottom:1px solid #e6ecea;text-align:left}thead th{background:#2f6b5a;color:#fff;font-weight:700}tbody th{font-weight:700}td.n{text-align:right;font-variant-numeric:tabular-nums}
tr.total>*{background:#eaf3ef;font-weight:700}.bar{display:flex;height:14px;min-width:160px;border-radius:7px;overflow:hidden;background:#eef2f0;box-shadow:inset 0 0 0 1px #c7d3ce}
.bar i{display:block;height:100%}.s5{background:#2f6b5a}.s4{background:#6fa58f}.s3{background:#9aa9a2}.s2{background:#e08a45}.s1{background:#a8460f}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;font-size:12px;color:#56655e}.legend span::before{content:'';display:inline-block;width:10px;height:10px;margin-right:4px;border-radius:2px;background:var(--c)}
.hbar{display:grid;grid-template-columns:7em 1fr 3em;align-items:center;gap:10px;margin:6px 0;font-size:14px}.hbar .track{height:14px}.hbar .track span{display:block;height:100%;border-radius:7px;background:#4f8a74}.hbar .num{text-align:right;font-variant-numeric:tabular-nums}
.comments{padding-left:1.2em}.comments li{margin-bottom:8px}.comments small{color:#56655e}.issues td.ex{color:#a8460f;font-weight:700}.wrap{overflow-x:auto}
@media (max-width:600px){main{padding:24px 16px 40px}th,td{padding:6px 8px}}
"""


def _fmt(v: float | None, pattern: str) -> str:
    return "—" if v is None else format(v, pattern)


def write_html(path: Path, cfg: Config, groups: list[Group], result: Result) -> None:
    total = groups[-1]
    e = escape
    rows = []
    for g in groups:
        bar = "".join(f'<i class="s{s}" style="width:{(n / g.count * 100) if g.count else 0:.1f}%"></i>' for s, n in g.distribution.items())
        label = "、".join(f"{s}が{n}件" for s, n in g.distribution.items())
        rows.append(
            f'<tr class="{"total" if g is total else ""}"><th scope="row">{e(g.name)}</th><td class="n">{g.count}</td>'
            f'<td class="n">{_fmt(g.average, ".1f")}</td><td><div class="bar" role="img" aria-label="満足度の内訳 {label}">{bar}</div></td>'
            f'<td class="n">{_fmt(g.again_rate, ".0%")}</td></tr>'
        )
    max_ch = max(total.channels.values()) or 1
    channels = "".join(
        f'<div class="hbar"><span>{e(c)}</span><span class="track"><span style="width:{total.channels[c] / max_ch * 100:.1f}%"></span></span>'
        f'<span class="num">{total.channels[c]}</span></div>'
        for c in CHANNELS
    )
    low = sorted((r for r in result.responses if r.comment and r.satisfaction <= 3), key=lambda r: r.satisfaction)
    comments = "".join(f"<li>{e(mask_personal(r.comment))} <small>（{e(r.source)}・満足度 {r.satisfaction}）</small></li>" for r in low) or "<li>ありません</li>"
    items = sorted(result.issues, key=lambda i: (not i.excluded,))
    issues = "".join(
        f'<tr><td class="{"ex" if i.excluded else ""}">{"集計から外した" if i.excluded else "集計に入れた"}</td><td>{e(i.source)}</td>'
        f'<td>{e(i.file)}</td><td class="n">{i.line}</td><td>{e(i.reason)}</td></tr>'
        for i in items
    ) or '<tr><td colspan="5">ありません</td></tr>'

    html = f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<meta name="description" content="{e(cfg.organization)}の{e(cfg.title)}（{e(cfg.period)}）。集計した回答 {total.count} 件、満足度の平均 {_fmt(total.average, '.1f')}。">
<title>{e(cfg.title)}（{e(cfg.period)}）｜{e(cfg.organization)}</title><style>{CSS}</style></head>
<body><main>
<h1>{e(cfg.organization)}　{e(cfg.title)}</h1>
<p class="meta">対象: {e(cfg.period)}　／　作成日: {date.today():%Y/%m/%d}　／　くわしい表とグラフは Excel のレポートにあります</p>
<div class="kpis">
<p class="kpi"><b>{total.count} 件</b><span>集計した回答</span></p>
<p class="kpi"><b>{_fmt(total.average, ".1f")}</b><span>満足度の平均（5 点満点）</span></p>
<p class="kpi"><b>{_fmt(total.again_rate, ".0%")}</b><span>また参加したい</span></p>
<p class="kpi kpi--warn"><b>{len(result.issues)} 件</b><span>要確認（うち集計から外した行 {len(result.excluded)} 件）</span></p>
</div>
<h2>教室別</h2>
<div class="wrap"><table><thead><tr><th scope="col">教室</th><th scope="col">回答数</th><th scope="col">満足度の平均</th><th scope="col">満足度の内訳</th><th scope="col">また参加したい</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
<p class="legend"><span style="--c:#2f6b5a">5 とても満足</span><span style="--c:#6fa58f">4</span><span style="--c:#9aa9a2">3</span><span style="--c:#e08a45">2</span><span style="--c:#a8460f">1 不満</span></p>
<h2>知ったきっかけ（全体・複数回答）</h2>
{channels}
<h2>満足度 3 以下のご意見</h2>
<ul class="comments">{comments}</ul>
<h2>要確認</h2>
<div class="wrap"><table class="issues"><thead><tr><th scope="col">扱い</th><th scope="col">教室</th><th scope="col">ファイル</th><th scope="col">行</th><th scope="col">理由</th></tr></thead><tbody>{issues}</tbody></table></div>
</main></body></html>
"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")
