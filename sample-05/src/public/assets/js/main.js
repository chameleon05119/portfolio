// ページ共通の処理。ビルドせずそのままコピーされる（クライアントが file:// で開いても動くよう、モジュールにしない）
// 機能ごとに関数を分け、対象の要素がないページでは何もしない
;(() => {
  'use strict'

  window.siteReady = true // head の「3秒で .js を外す」保険を止める
  // 回線が遅く、保険で .js が外れたあとに読み込まれた場合も、ここで付け直してフォームなどを動かす
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

  // ===== スマホの追従ボタン（最初の画面を過ぎたら出し、ページの最後の CTA が見えたら隠す） =====
  function initFixedCta() {
    const bar = document.querySelector('[data-fixed-cta]')
    const fv = document.querySelector('.p-fv')
    const cta = document.querySelector('.c-cta')
    if (!bar || !fv || !('IntersectionObserver' in window)) return
    const state = { pastFv: false, atCta: false }
    const update = () => {
      const shown = state.pastFv && !state.atCta
      bar.classList.toggle('is-shown', shown)
      bar.inert = !shown // 隠れている間は Tab で止まらないように
    }
    new IntersectionObserver(([e]) => {
      state.pastFv = !e.isIntersecting && e.boundingClientRect.top < 0
      update()
    }).observe(fv)
    if (cta)
      new IntersectionObserver(([e]) => {
        state.atCta = e.isIntersecting
        update()
      }).observe(cta)
    update()
  }

  // ===== 料金の月払い / 年払いの切り替え =====
  function initBilling() {
    const group = document.querySelector('[data-billing-group]')
    if (!group) return
    const buttons = group.querySelectorAll('button')
    const status = document.querySelector('[data-billing-status]')
    group.hidden = false // JS が動かない環境では切り替えを出さず、年払いの金額だけを見せる
    buttons.forEach((button) =>
      button.addEventListener('click', () => {
        const key = button.dataset.billing
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)))
        document.querySelectorAll('[data-monthly][data-yearly]').forEach((el) => (el.textContent = el.dataset[key]))
        // 金額が変わったことを読み上げで知らせる
        if (status) status.textContent = key === 'monthly' ? '月払いの料金を表示しています' : '年払いの料金を表示しています'
      }),
    )
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

  // ===== 数字のカウントアップ =====
  function initCount() {
    const targets = document.querySelectorAll('[data-count]')
    if (!targets.length || reduceMotion || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          io.unobserve(e.target)
          const el = e.target
          const to = Number(el.dataset.count)
          const start = performance.now()
          const step = (now) => {
            const p = Math.min(1, (now - start) / 1200)
            el.textContent = String(Math.round(to * (1 - (1 - p) ** 3)))
            if (p < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        })
      },
      { threshold: 0.6 },
    )
    // 画面に入る前は 0 にしておく（JS が動かないときは最終値のまま見える）
    targets.forEach((el) => {
      el.textContent = '0'
      io.observe(el)
    })
  }

  // ===== ロゴの帯の一時停止 =====
  function initMarquee() {
    const button = document.querySelector('[data-marquee-toggle]')
    if (!button || reduceMotion) return // 動きを減らす設定では最初から止まっているので出さない
    const wrap = button.closest('.p-logos')
    button.hidden = false
    button.addEventListener('click', () => {
      const paused = wrap.classList.toggle('is-paused')
      button.textContent = paused ? 'ロゴを動かす' : 'ロゴの動きを止める'
    })
  }

  // ===== 資料請求・お問い合わせフォーム（入力 → 確認 → 完了） =====
  // デモサイトのため実際には送信しない。本番では送信先（フォームサービスや MA ツール）につなぐ
  function initRequestForm() {
    const form = document.querySelector('[data-request-form]')
    if (!form) return
    const inputStep = document.querySelector('[data-step="input"]')
    const confirmStep = document.querySelector('[data-step="confirm"]')
    const steps = document.querySelectorAll('.p-steps-bar li')
    const summary = form.querySelector('.p-form__summary')
    const messageBadge = form.querySelector('[data-message-badge]')
    const isContact = () => form.elements.type.value === 'contact'

    // 「お問い合わせ」「無料でためす」から来たら、ご用件を切り替えておく
    const preset = new URLSearchParams(location.search).get('type')
    if (preset === 'contact' || preset === 'trial') form.elements.type.value = preset

    // ご用件が「ご相談」のときだけ、ご相談内容を必須にする
    const syncType = () => {
      const contact = isContact()
      messageBadge.textContent = contact ? '必須' : '任意'
      messageBadge.className = contact ? 'p-form__req' : 'p-form__opt'
      form.elements.message.required = contact
      // 必須でなくなったら、出ていたエラーを消す
      if (!contact && form.elements.message.getAttribute('aria-invalid') === 'true') check('message')
    }

    const rules = {
      company: (f) => (f.elements.company.value.trim() ? '' : '会社名を入力してください'),
      name: (f) => (f.elements.name.value.trim() ? '' : 'お名前を入力してください'),
      email: (f) => {
        const v = f.elements.email.value.trim()
        if (!v) return 'メールアドレスを入力してください'
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'メールアドレスの形式が正しくありません（例: name@example.co.jp）'
      },
      tel: (f) => {
        const v = f.elements.tel.value.trim()
        return !v || /^[0-9０-９+\-－() ]{10,16}$/.test(v) ? '' : '電話番号は数字とハイフンで入力してください'
      },
      size: (f) => (f.elements.size.value ? '' : '従業員数を選んでください'),
      message: (f) => (!isContact() || f.elements.message.value.trim() ? '' : 'ご相談内容を入力してください'),
      agree: (f) => (f.elements.agree.checked ? '' : '個人情報の取り扱いへの同意が必要です'),
    }

    function check(name) {
      const message = rules[name](form)
      document.getElementById(`${name}-error`).textContent = message
      form.elements[name].setAttribute('aria-invalid', String(!!message))
      // 上のエラー一覧からも、直った項目を消す（すべて直ったら一覧を閉じる）
      if (!message) {
        summary.querySelector(`li[data-for="${name}"]`)?.remove()
        if (!summary.querySelector('li')) summary.hidden = true
      }
      return message
    }

    // 入力し終えた項目からその場で確認する（入力中は邪魔しない）。
    // すでにエラーが出ている項目だけは入力中にも確認し、直った時点でエラーを消す
    // （フォーカスが外れた瞬間にエラー文が消えると下の要素がずれ、次に押そうとしたボタンを押し損ねるため）
    Object.keys(rules).forEach((name) => {
      const el = form.elements[name]
      const choice = ['checkbox', 'select-one'].includes(el.type)
      el.addEventListener(choice ? 'change' : 'blur', () => check(name))
      if (!choice) el.addEventListener('input', () => el.getAttribute('aria-invalid') === 'true' && check(name))
    })
    form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', syncType))
    syncType()

    const label = (name) => form.querySelector(`[data-label="${name}"]`)?.textContent.trim() ?? name
    const setStep = (i) =>
      steps.forEach((s, j) => (j === i ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current')))

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const errors = Object.keys(rules)
        .map((name) => [name, check(name)])
        .filter(([, m]) => m)
      if (errors.length) {
        // まとめて知らせ、各エラーから該当の項目へ移動できるようにする
        summary.hidden = false
        summary.querySelector('ul').replaceChildren(
          ...errors.map(([name, m]) => {
            const li = document.createElement('li')
            li.dataset.for = name
            const a = document.createElement('a')
            a.href = `#${name}`
            a.textContent = m
            li.append(a)
            return li
          }),
        )
        summary.focus()
        return
      }
      summary.hidden = true
      const v = (name) => form.elements[name].value.trim()
      const rows = [
        [label('type'), form.querySelector('input[name="type"]:checked').closest('label').textContent.trim()],
        [label('company'), v('company')],
        [label('name'), v('name')],
        [label('dept'), v('dept') || '（未入力）'],
        [label('email'), v('email')],
        [label('tel'), v('tel') || '（未入力）'],
        [label('size'), v('size')],
        [label('message'), v('message') || '（未入力）'],
      ]
      confirmStep.querySelector('tbody').replaceChildren(
        ...rows.map(([k, val]) => {
          const tr = document.createElement('tr')
          const th = document.createElement('th')
          const td = document.createElement('td')
          th.scope = 'row'
          th.textContent = k
          td.textContent = val // 入力内容は textContent で入れる（HTML として解釈しない）
          tr.append(th, td)
          return tr
        }),
      )
      inputStep.hidden = true
      confirmStep.hidden = false
      setStep(1)
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
      confirmStep.querySelector('h2').focus({ preventScroll: true })
    })

    confirmStep.querySelector('[data-back]').addEventListener('click', () => {
      confirmStep.hidden = true
      inputStep.hidden = false
      setStep(0)
      form.querySelector('button[type="submit"]').focus()
    })
    confirmStep.querySelector('[data-send]').addEventListener('click', () => {
      // デモのため送信せずに完了ページへ（入力内容は URL に載せない）
      location.href = './thanks.html'
    })
  }

  // 何かで失敗しても、隠した要素が出ないままにならないようにする
  try {
    initHeader()
    initFixedCta()
    initBilling()
    initReveal()
    initCount()
    initMarquee()
    initRequestForm()
  } catch (error) {
    document.documentElement.classList.remove('js')
    console.error(error)
  }
})()
