// リニューアル後のサイト（after/）の処理。ビルドせずそのままコピーされる（file:// で開いても動くよう、モジュールにしない）
// 機能ごとに関数を分け、対象の要素がないページでは何もしない
;(() => {
  'use strict'

  window.siteReady = true // head の「3秒で .js を外す」保険を止める
  document.documentElement.classList.add('js')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ===== スクロールしたらヘッダーに境界線 =====
  function initHeader() {
    const header = document.querySelector('.l-header')
    if (!header) return
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8)
    window.addEventListener('scroll', update, { passive: true })
    update()
  }

  // ===== PC 幅未満のメニュー（開閉・リンクを押したら閉じる・Esc で閉じる） =====
  function initMenu() {
    const header = document.querySelector('.l-header')
    const btn = document.querySelector('[data-menu-btn]')
    const nav = document.getElementById('site-menu')
    if (!header || !btn || !nav) return
    const label = btn.querySelector('[data-menu-label]')
    const set = (open) => {
      header.classList.toggle('is-open', open)
      btn.setAttribute('aria-expanded', String(open))
      label.textContent = open ? '閉じる' : 'メニュー'
    }
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'))
    nav.addEventListener('click', (e) => e.target.closest('a') && set(false))
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        set(false)
        btn.focus()
      }
    })
    // PC 幅に広げたら閉じた状態に戻す
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => e.matches && set(false))
  }

  // ===== スマホの「電話・予約」バー（最初の画面を過ぎたら出し、予約フォームが見えたら隠す） =====
  function initBottomBar() {
    const bar = document.querySelector('[data-bottom-bar]')
    const fv = document.querySelector('.p-fv')
    const contact = document.querySelector('#contact')
    if (!bar || !fv || !('IntersectionObserver' in window)) return
    const state = { pastFv: false, atContact: false }
    const update = () => {
      const shown = state.pastFv && !state.atContact
      bar.classList.toggle('is-shown', shown)
      bar.inert = !shown // 隠れている間は Tab で止まらないように
    }
    new IntersectionObserver(([e]) => {
      state.pastFv = !e.isIntersecting && e.boundingClientRect.top < 0
      update()
    }).observe(fv)
    if (contact)
      new IntersectionObserver(([e]) => {
        state.atContact = e.isIntersecting
        update()
      }).observe(contact)
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
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }),
      { rootMargin: '0px 0px -10% 0px' },
    )
    targets.forEach((el) => io.observe(el))
    // ページ内リンクで飛んだときなど、画面より上の要素は最初から表示しておく
    window.addEventListener('load', () =>
      targets.forEach((el) => {
        if (el.getBoundingClientRect().bottom < 0) el.classList.add('is-in')
      }),
    )
  }

  // ===== よくある質問（開閉をなめらかにする） =====
  function initFaq() {
    document.querySelectorAll('.c-faq').forEach((details) => {
      const summary = details.querySelector('summary')
      const body = details.querySelector('.c-faq__body')
      summary.addEventListener('click', (e) => {
        if (reduceMotion || !body.animate) return
        e.preventDefault()
        if (details.open) {
          const anim = body.animate({ height: [`${body.offsetHeight}px`, '0px'] }, { duration: 220, easing: 'ease-out' })
          anim.onfinish = () => (details.open = false)
        } else {
          details.open = true
          body.animate({ height: ['0px', `${body.offsetHeight}px`] }, { duration: 260, easing: 'ease-out' })
        }
      })
    })
  }

  // ===== 予約フォーム =====
  // 入力し終えた項目からその場で確認し、送信時は最初のエラーの項目へ移動する。
  // デモのため送信はせず、受付のメッセージに切り替えるだけ（本番ではフォームの送信先・自動返信メールを設定する）
  function initContactForm() {
    const form = document.querySelector('[data-contact-form]')
    if (!form) return
    const done = document.querySelector('[data-contact-done]')
    const submit = form.querySelector('[type="submit"]')
    submit.disabled = false // JS が動かない環境では押せないままにする

    const f = form.elements
    const rules = {
      name: () => (f.name.value.trim() ? '' : 'お名前を入力してください'),
      email: () => {
        const v = f.email.value.trim()
        if (!v) return 'メールアドレスを入力してください'
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'メールアドレスの形式が正しくありません（例: name@example.jp）'
      },
      topic: () => (form.querySelector('input[name="topic"]:checked') ? '' : 'ご相談の内容を選んでください'),
      agree: () => (f.agree.checked ? '' : '個人情報の取り扱いへの同意が必要です'),
    }
    const errorEl = (name) => form.querySelector(`#f-${name}-error`)
    const show = (name) => {
      const msg = rules[name]()
      errorEl(name).textContent = msg
      if (name === 'topic') {
        const radios = form.querySelectorAll('input[name="topic"]')
        radios[0].closest('.c-form__row').toggleAttribute('data-invalid', Boolean(msg))
        radios.forEach((r) => r.setAttribute('aria-invalid', String(Boolean(msg))))
      } else {
        f[name].setAttribute('aria-invalid', String(Boolean(msg)))
      }
      return !msg
    }

    // 入力欄は離れたとき、選択肢はその場で確認する。一度エラーが出た欄は、直したらすぐ消す
    ;['name', 'email'].forEach((name) => {
      f[name].addEventListener('blur', () => f[name].value && show(name))
      f[name].addEventListener('input', () => errorEl(name).textContent && show(name))
    })
    form.addEventListener('change', (e) => {
      if (e.target.name === 'topic' || e.target.name === 'agree') show(e.target.name)
    })

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const invalid = Object.keys(rules).filter((name) => !show(name))
      if (invalid.length) {
        const first = invalid[0] === 'topic' ? form.querySelector('input[name="topic"]') : f[invalid[0]]
        first.focus()
        return
      }
      form.hidden = true
      done.hidden = false
      done.focus({ preventScroll: true })
      done.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' }) // フォームが消えて縮んだ分、位置を合わせる
    })
  }

  initHeader()
  initMenu()
  initBottomBar()
  initReveal()
  initFaq()
  initContactForm()
})()
