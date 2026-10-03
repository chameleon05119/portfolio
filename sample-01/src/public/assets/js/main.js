// ページ共通の処理。ビルドせずそのままコピーされる（クライアントが file:// で開いても動くよう、モジュールにしない）
// 機能ごとに関数を分け、片方が失敗してももう片方は動くようにしている
;(() => {
  'use strict'

  // --- ハンバーガーメニュー -------------------------------------------------
  // 開いている間は背面（.js-menu-outside）を inert にして、フォーカスがメニューの外へ出ないようにする
  const initMenu = () => {
    const toggle = document.querySelector('.js-menu-toggle')
    const menu = toggle && document.getElementById(toggle.getAttribute('aria-controls'))
    if (!toggle || !menu) return

    const outside = document.querySelectorAll('.js-menu-outside')
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true'

    const setMenu = (open) => {
      if (open) {
        const width = window.innerWidth - document.documentElement.clientWidth
        document.body.style.setProperty('--scrollbar-width', `${width}px`)
      }
      toggle.setAttribute('aria-expanded', String(open))
      menu.classList.toggle('is-open', open)
      menu.inert = !open
      outside.forEach((el) => (el.inert = open))
      document.body.classList.toggle('is-menu-open', open)
    }

    const close = () => {
      setMenu(false)
      toggle.focus()
    }

    setMenu(false)
    toggle.addEventListener('click', () => (isOpen() ? close() : setMenu(true)))
    // ページ内リンクで閉じたときは、移動先へフォーカスが進むのでボタンには戻さない
    menu.querySelectorAll('.js-menu-link').forEach((link) => link.addEventListener('click', () => setMenu(false)))
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) close()
    })
  }

  // --- スクロールで表示 -------------------------------------------------------
  const initReveal = () => {
    const targets = document.querySelectorAll('.js-reveal')
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    targets.forEach((el) => observer.observe(el))
  }

  try {
    initMenu()
  } catch (error) {
    console.error(error)
  }

  try {
    initReveal()
  } catch (error) {
    // 表示処理が失敗しても、隠したままのコンテンツが残らないようにする
    console.error(error)
    document.querySelectorAll('.js-reveal').forEach((el) => el.classList.add('is-visible'))
  }
})()
