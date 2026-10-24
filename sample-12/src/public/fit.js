// 印刷サイズで組んだ原稿を、狭い画面では画面幅に縮めて表示する（スマホで原稿を開いたとき用）
// 書き出し（scripts/export.mjs）は広い画面で開くので縮めない。印刷するときは元の大きさに戻す
(() => {
  const content = Number(document.documentElement.dataset.fitWidth)
  const fit = () => {
    const z = Math.min(1, (window.innerWidth - 16) / content)
    document.body.style.zoom = z < 1 ? String(z) : ''
  }
  fit()
  window.addEventListener('resize', fit)
  window.addEventListener('beforeprint', () => { document.body.style.zoom = '' })
  window.addEventListener('afterprint', fit)
})()
