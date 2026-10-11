// 比較ページの処理（PC / スマホのタブ、前後を重ねるスライダー）。ビルドせずそのままコピーされる
;(() => {
  'use strict'

  // ===== 前後を重ねるスライダー: range の値を CSS 変数 --pos に入れる =====
  document.querySelectorAll('[data-slider]').forEach((slider) => {
    const range = slider.querySelector('input[type="range"]')
    const update = () => {
      slider.style.setProperty('--pos', `${range.value}%`)
      range.setAttribute('aria-valuetext', `前 ${range.value}%・後 ${100 - range.value}%`)
    }
    range.addEventListener('input', update)
    update()
  })

  // ===== PC / スマホのタブ（左右キーで切り替え） =====
  const tabs = [...document.querySelectorAll('[role="tab"]')]
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab
      t.setAttribute('aria-selected', String(on))
      t.tabIndex = on ? 0 : -1
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on
    })
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
      select(next)
      next.focus()
    })
  })
})()
