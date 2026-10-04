// ページ共通の処理（テーマの functions から読み込む。ビルドせずそのまま使う）
// 機能ごとに関数を分け、対象の要素がないページでは何もしない
;(() => {
  'use strict'
  window.siteReady = true // head の保険（3秒で .js を外す）を止める

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ===== スマホ・タブレットのメニュー =====
  function initDrawer() {
    const button = document.querySelector('.l-header__menu')
    const drawer = document.getElementById('drawer')
    if (!button || !drawer) return
    // メニューを開いている間は、背面（本文・フッター）を操作できないようにする
    const behind = [document.querySelector('main'), document.querySelector('footer'), document.querySelector('.u-skip')].filter(Boolean)

    let hideTimer = 0
    const open = () => {
      clearTimeout(hideTimer) // 閉じている途中で開き直したときに、あとから非表示にされないように
      drawer.hidden = false
      button.setAttribute('aria-expanded', 'true')
      button.setAttribute('aria-label', 'メニューを閉じる')
      behind.forEach((el) => (el.inert = true))
      document.body.style.overflow = 'hidden'
      // 表示されてから最初のリンクにフォーカスを移す（非表示の間はフォーカスできない）
      requestAnimationFrame(() => {
        drawer.classList.add('is-open')
        drawer.querySelector('a')?.focus()
      })
    }
    const close = ({ focus = true } = {}) => {
      drawer.classList.remove('is-open')
      button.setAttribute('aria-expanded', 'false')
      button.setAttribute('aria-label', 'メニューを開く')
      behind.forEach((el) => (el.inert = false))
      document.body.style.overflow = ''
      hideTimer = setTimeout(() => (drawer.hidden = true), reduceMotion ? 0 : 300)
      if (focus) button.focus()
    }

    button.addEventListener('click', () => (button.getAttribute('aria-expanded') === 'true' ? close() : open()))
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') close()
    })
    drawer.addEventListener('click', (e) => {
      if (e.target.closest('a')) close({ focus: false })
    })
    // PC 幅になったら閉じる
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
      if (e.matches && button.getAttribute('aria-expanded') === 'true') close({ focus: false })
    })
  }

  // ===== スクロールで表示されたらふわっと出す =====
  function initReveal() {
    const targets = document.querySelectorAll('.u-reveal')
    if (!targets.length) return
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        })
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    targets.forEach((el) => io.observe(el))
    // ページ内リンクで飛んだときなど、画面より上の要素は最初から表示しておく
    window.addEventListener('load', () => {
      targets.forEach((el) => {
        if (el.getBoundingClientRect().bottom < 0) el.classList.add('is-in')
      })
    })
  }

  // ===== 営業日の判定 =====
  // 営業時間・定休日・臨時休業/営業は、管理画面「お店の情報」の値が window.hitotokiShop に入る（inc/shop-settings.php）
  // 時刻は見ている人の端末の時計で判定する（日本国内からの閲覧を想定）
  const shop = Object.assign(
    { open: 8 * 60, close: 18 * 60, openLabel: '8:00', closedDays: [3], closedNth: [{ nth: 3, day: 4 }], closed: [], opened: [] },
    window.hitotokiShop,
  )
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  function isHoliday(d) {
    if (shop.opened.includes(ymd(d))) return false
    if (shop.closed.includes(ymd(d))) return true
    if (shop.closedDays.includes(d.getDay())) return true
    return shop.closedNth.some((r) => r.day === d.getDay() && Math.ceil(d.getDate() / 7) === r.nth)
  }

  // ===== 最初の画面の「本日の営業」 =====
  function initToday() {
    const status = document.querySelector('[data-today-status]')
    if (!status) return
    const now = new Date()
    const min = now.getHours() * 60 + now.getMinutes()
    let text = '本日 営業中'
    if (isHoliday(now)) text = '本日 定休日'
    else if (min < shop.open) text = `本日 ${shop.openLabel} から営業`
    else if (min >= shop.close) text = '本日の営業は終了'
    status.textContent = text
    status.classList.toggle('is-closed', text !== '本日 営業中')
  }

  // ===== 今月の営業カレンダー =====
  function initCalendar() {
    const root = document.querySelector('[data-calendar]')
    if (!root) return
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const first = new Date(y, m, 1).getDay()
    const days = new Date(y, m + 1, 0).getDate()

    const table = document.createElement('table')
    table.createCaption().textContent = `${y}年${m + 1}月の営業日`
    const head = table.createTHead().insertRow()
    '日月火水木金土'.split('').forEach((w) => {
      const th = document.createElement('th')
      th.scope = 'col'
      th.textContent = w
      head.append(th)
    })
    const body = table.createTBody()
    let row = body.insertRow()
    for (let i = 0; i < first; i++) row.insertCell().setAttribute('aria-hidden', 'true')
    for (let d = 1; d <= days; d++) {
      if (row.cells.length === 7) row = body.insertRow()
      const date = new Date(y, m, d)
      const cell = row.insertCell()
      const span = document.createElement('span')
      span.textContent = d
      cell.append(span)
      if (isHoliday(date)) {
        cell.classList.add('is-off')
        span.insertAdjacentHTML('beforeend', '<span class="u-visually-hidden">（お休み）</span>')
      }
      if (d === now.getDate()) {
        cell.classList.add('is-today')
        cell.setAttribute('aria-current', 'date')
        span.insertAdjacentHTML('beforeend', '<span class="u-visually-hidden">（今日）</span>')
      }
    }
    const legend = document.createElement('p')
    legend.className = 'p-calendar__legend'
    legend.textContent = '＝お休み'
    legend.setAttribute('aria-hidden', 'true')
    root.append(table, legend)
  }

  // ===== 店内写真の拡大表示 =====
  function initLightbox() {
    const grid = document.querySelector('[data-lightbox]')
    const dialog = document.querySelector('.p-lightbox')
    if (!grid || !dialog || typeof dialog.showModal !== 'function') return
    const img = dialog.querySelector('img')
    const caption = dialog.querySelector('p')
    let opener = null
    grid.addEventListener('click', (e) => {
      const button = e.target.closest('button')
      if (!button) return
      opener = button
      const thumb = button.querySelector('img')
      // srcset のいちばん大きい画像を拡大表示に使う
      const largest = thumb.srcset.split(',').map((c) => c.trim().split(/\s+/)[0]).pop()
      img.src = largest || thumb.currentSrc || thumb.src
      caption.textContent = thumb.alt // 写真の説明はキャプションで読ませる（img の alt は空にして二重に読ませない）
      dialog.showModal()
    })
    dialog.querySelector('button').addEventListener('click', () => dialog.close())
    // 写真の外（暗い部分）を押しても閉じる
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close()
    })
    dialog.addEventListener('close', () => opener?.focus())
  }

  // ===== メニューページ: 今見ている分類を上のナビで示す =====
  function initMenuNav() {
    const links = [...document.querySelectorAll('.p-menu-nav a')]
    if (!links.length || !('IntersectionObserver' in window)) return
    // 分類のスラッグが日本語だと a.hash は %E3… とエンコードされるので、戻してから id で探す
    const idOf = (a) => decodeURIComponent(a.hash.slice(1))
    const sections = links.map((a) => document.getElementById(idOf(a))).filter(Boolean)
    const set = (id) =>
      links.forEach((a) => {
        const on = idOf(a) === id
        if (on) a.setAttribute('aria-current', 'true')
        else a.removeAttribute('aria-current')
        // スマホで横にはみ出しているときは、今の分類が見えるように横だけ寄せる（ページは動かさない）
        if (on) {
          const list = a.closest('ul')
          list.scrollTo({ left: a.offsetLeft - (list.clientWidth - a.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' })
        }
      })
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && set(e.target.id)),
      { rootMargin: '-40% 0px -55% 0px' },
    )
    sections.forEach((s) => io.observe(s))
  }

  // 何かで失敗しても、隠した要素が出ないままにならないようにする
  // 機能ごとに失敗を閉じ込め、1つ失敗してもほかは動かす。表示に関わる initReveal が失敗したら全部表示する
  ;[initDrawer, initToday, initCalendar, initLightbox, initMenuNav].forEach((init) => {
    try {
      init()
    } catch (error) {
      console.error(error)
    }
  })
  try {
    initReveal()
  } catch (error) {
    document.documentElement.classList.remove('js')
    console.error(error)
  }
})()
