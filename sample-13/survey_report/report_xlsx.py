"""Excel のレポート（サマリー・回答一覧・自由記述・要確認の 4 シート）を作る。"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from .aggregate import Group
from .config import Config
from .normalize import AGE_BANDS, CHANNELS, Result

BLUE = "2F6B5A"
HEAD_FILL = PatternFill("solid", fgColor=BLUE)
TOTAL_FILL = PatternFill("solid", fgColor="EAF3EF")
HEAD_FONT = Font(bold=True, color="FFFFFF")
THIN = Side(style="thin", color="C9D6D0")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center")


def put(ws: Worksheet, row: int, col: int, value):
    """セルに値を入れる。「=」「+」「-」「@」で始まる文字列も、数式ではなく文字として入れる（回答の中身が数式として動かないように）。"""
    c = ws.cell(row, col, value)
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@"):
        c.value = value
        c.data_type = "s"
    return c


def write_table(ws: Worksheet, top: int, left: int, header: list[str], rows: list[list], *, total_last: bool = False, formats: dict[int, str] | None = None) -> tuple[int, int]:
    """表を書いて、(最後の行, 最後の列) を返す。formats は {列の位置(0 始まり): 表示形式}。"""
    for j, h in enumerate(header):
        c = put(ws, top, left + j, h)
        c.fill, c.font, c.border, c.alignment = HEAD_FILL, HEAD_FONT, BORDER, CENTER
    for i, row in enumerate(rows, start=1):
        for j, v in enumerate(row):
            c = put(ws, top + i, left + j, v)
            c.border = BORDER
            if formats and j in formats:
                c.number_format = formats[j]
            if total_last and i == len(rows):
                c.fill, c.font = TOTAL_FILL, Font(bold=True)
    return top + len(rows), left + len(header) - 1


def bar_chart(title: str, *, y_title: str = "", percent: bool = False, stacked: bool = False, horizontal: bool = False) -> BarChart:
    ch = BarChart()
    ch.type = "bar" if horizontal else "col"
    ch.title = title
    ch.style = 10
    ch.y_axis.title = y_title
    ch.y_axis.majorGridlines = None
    ch.height, ch.width = 7.5, 15
    ch.legend.position = "b"
    if stacked:
        ch.grouping = "percentStacked" if percent else "stacked"
        ch.overlap = 100
    # 新しい Excel で軸が消えないよう、明示的に表示する
    ch.x_axis.delete = False
    ch.y_axis.delete = False
    return ch


def build_summary(ws: Worksheet, cfg: Config, groups: list[Group], result: Result) -> None:
    ws.title = "サマリー"
    ws["A1"] = f"{cfg.organization}　{cfg.title}"
    ws["A1"].font = Font(bold=True, size=16, color=BLUE)
    ws["A2"] = f"対象: {cfg.period}　／　作成日: {date.today():%Y/%m/%d}"
    ws["A3"] = (f"集計した回答 {len(result.responses)} 件　／　集計から外した行 {len(result.excluded)} 件"
                f"　／　要確認 {len(result.issues)} 件（「要確認」シート）　／　空行 {result.blank_rows} 行")
    ws["A3"].font = Font(bold=True)

    # 1. 教室別
    ws["A5"] = "1. 教室別の満足度と「また参加したい」"
    ws["A5"].font = Font(bold=True, size=12)
    rows = [[g.name, g.count, g.average, *g.distribution.values(), g.again_rate] for g in groups]
    end1, _ = write_table(ws, 6, 1, ["教室", "回答数", "満足度の平均", "5", "4", "3", "2", "1", "また参加したい"], rows,
                          total_last=True, formats={2: "0.0", 8: "0%"})
    ws.cell(end1 + 1, 1, "満足度は 5 = とても満足 〜 1 = 不満。「また参加したい」は「はい」÷ 回答した人（未回答を除く）").font = Font(size=9, color="666666")

    # 2. きっかけ
    top2 = end1 + 3
    ws.cell(top2, 1, "2. レッスンを知ったきっかけ（複数回答）").font = Font(bold=True, size=12)
    names = [g.name for g in groups]
    rows2 = [[c, *[g.channels[c] for g in groups]] for c in CHANNELS]
    end2, _ = write_table(ws, top2 + 1, 1, ["きっかけ", *names], rows2)

    # 3. 年代
    top3 = end2 + 3
    ws.cell(top3, 1, "3. 年代").font = Font(bold=True, size=12)
    rows3 = [[a, *[g.ages[a] for g in groups]] for a in AGE_BANDS]
    write_table(ws, top3 + 1, 1, ["年代", *names], rows3)

    # グラフ（表の右側）
    venues = len(groups) - 1  # 「全体」を除く
    ch1 = bar_chart("教室別 満足度の平均（5 点満点）")
    ch1.add_data(Reference(ws, min_col=3, min_row=6, max_row=6 + venues + 1), titles_from_data=True)
    ch1.set_categories(Reference(ws, min_col=1, min_row=7, max_row=6 + venues + 1))
    ch1.y_axis.scaling.min, ch1.y_axis.scaling.max = 1, 5
    ch1.legend = None
    ch1.dataLabels = DataLabelList()
    ch1.dataLabels.showVal = True
    ch1.dataLabels.numFmt = "0.0"
    ws.add_chart(ch1, "K5")

    ch2 = bar_chart("教室別 満足度の内訳", stacked=True, percent=True, horizontal=True)
    ch2.add_data(Reference(ws, min_col=4, max_col=8, min_row=6, max_row=6 + venues), titles_from_data=True)
    ch2.set_categories(Reference(ws, min_col=1, min_row=7, max_row=6 + venues))
    ch2.y_axis.number_format = "0%"
    ws.add_chart(ch2, "K21")

    ch3 = bar_chart("知ったきっかけ（全体）", horizontal=True)
    total_col = 1 + len(groups)
    ch3.add_data(Reference(ws, min_col=total_col, min_row=top2 + 1, max_row=top2 + 1 + len(CHANNELS)), titles_from_data=True)
    ch3.set_categories(Reference(ws, min_col=1, min_row=top2 + 2, max_row=top2 + 1 + len(CHANNELS)))
    ch3.legend = None
    ws.add_chart(ch3, "K37")

    # 表 2・3 は教室名が見出しに入るので、B 列から先は教室名が収まる幅にする
    for col, width in zip("ABCDEFGHI", (16, 12, 13, 12, 12, 8, 8, 8, 15)):
        ws.column_dimensions[col].width = width
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def build_list(ws: Worksheet, result: Result) -> None:
    ws.title = "回答一覧"
    rows = [[r.source, r.date, r.age, r.satisfaction, r.again, "、".join(r.channels), r.comment] for r in result.responses]
    end, last = write_table(ws, 1, 1, ["教室", "日付", "年代", "満足度", "また参加したい", "知ったきっかけ", "ご意見・ご感想"], rows, formats={1: "yyyy/m/d"})
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(last)}{end}"
    for col, width in zip("ABCDEFG", (13, 11, 10, 8, 14, 22, 60)):
        ws.column_dimensions[col].width = width


def build_comments(ws: Worksheet, result: Result) -> None:
    ws.title = "自由記述"
    # 満足度の低い順に並べる（直すべきことが先に目に入るように）
    items = sorted((r for r in result.responses if r.comment), key=lambda r: (r.satisfaction, r.source))
    rows = [[r.satisfaction, r.source, r.date, r.comment] for r in items]
    end, _ = write_table(ws, 1, 1, ["満足度", "教室", "日付", "ご意見・ご感想"], rows, formats={2: "yyyy/m/d"})
    for row in ws.iter_rows(min_row=2, max_row=end, min_col=4, max_col=4):
        row[0].alignment = WRAP
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:D{end}"
    for col, width in zip("ABCD", (8, 13, 11, 70)):
        ws.column_dimensions[col].width = width


def build_issues(ws: Worksheet, result: Result) -> None:
    ws.title = "要確認"
    if not result.issues:
        ws["A1"] = "確認が必要な行はありません。"
        return
    # 集計から外した行を先に並べる
    items = sorted(result.issues, key=lambda i: (not i.excluded,))
    rows = [["集計から外した" if i.excluded else "集計に入れた", i.source, i.file, i.line, i.reason, i.raw] for i in items]
    write_table(ws, 1, 1, ["扱い", "教室", "ファイル", "行", "理由", "元の内容"], rows)
    for row in ws.iter_rows(min_row=2, max_col=1):
        if row[0].value == "集計から外した":
            row[0].font = Font(bold=True, color="B8460F")
    ws.freeze_panes = "A2"
    for col, width in zip("ABCDEF", (14, 13, 28, 6, 52, 60)):
        ws.column_dimensions[col].width = width


def write_xlsx(path: Path, cfg: Config, groups: list[Group], result: Result) -> None:
    wb = Workbook()
    build_summary(wb.active, cfg, groups, result)
    build_list(wb.create_sheet(), result)
    build_comments(wb.create_sheet(), result)
    build_issues(wb.create_sheet(), result)
    if result.issues:
        wb["要確認"].sheet_properties.tabColor = "E07A2F"
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
