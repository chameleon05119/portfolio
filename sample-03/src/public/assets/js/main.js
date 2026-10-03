// ページ共通の処理。ビルドせずそのままコピーされる（クライアントが file:// で開いても動くよう、モジュールにしない）
// 機能ごとに関数を分け、対象の要素がないページでは何もしない
;(() => {
  'use strict'

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
          const from = to > 1000 ? to - 60 : 0 // 「1958年」は 0 からではなく近い値から
          const start = performance.now()
          const step = (now) => {
            const p = Math.min(1, (now - start) / 1400)
            el.textContent = String(Math.round(from + (to - from) * (1 - (1 - p) ** 3)))
            if (p < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        })
      },
      { threshold: 0.6 },
    )
    targets.forEach((el) => io.observe(el))
  }

  // ===== お知らせのカテゴリ絞り込み =====
  function initNewsFilter() {
    const filter = document.querySelector('.p-news-filter')
    const list = document.querySelector('[data-news-list]')
    if (!filter || !list) return
    filter.hidden = false // JS が動かないときは絞り込みを出さず全件表示
    const status = document.querySelector('[data-news-status]')
    filter.addEventListener('click', (e) => {
      const button = e.target.closest('button')
      if (!button) return
      const cat = button.dataset.cat
      filter.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)))
      let shown = 0
      list.querySelectorAll('li').forEach((li) => {
        const hit = cat === 'all' || li.dataset.cat === cat
        li.hidden = !hit
        if (hit) shown++
      })
      if (status) status.textContent = `${button.textContent}：${shown}件`
    })
  }

  // ===== タブ（採用情報の職種切替）。矢印キーで移動できる =====
  function initTabs() {
    document.querySelectorAll('[data-tabs]').forEach((root) => {
      const tabs = [...root.querySelectorAll('[role="tab"]')]
      const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')))
      root.querySelector('[role="tablist"]').hidden = false
      const select = (i, focus) => {
        tabs.forEach((t, j) => {
          t.setAttribute('aria-selected', String(i === j))
          t.tabIndex = i === j ? 0 : -1
          panels[j].hidden = i !== j
        })
        if (focus) tabs[i].focus()
      }
      tabs.forEach((t, i) => {
        t.addEventListener('click', () => select(i))
        t.addEventListener('keydown', (e) => {
          const move = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
          if (move) select((i + move + tabs.length) % tabs.length, true)
          if (e.key === 'Home') select(0, true)
          if (e.key === 'End') select(tabs.length - 1, true)
        })
      })
      select(0)
    })
  }

  // ===== お問い合わせフォーム（入力 → 確認 → 完了） =====
  // デモサイトのため実際には送信しない。本番では送信先（フォームサービスやサーバー）につなぐ
  function initContact() {
    const form = document.querySelector('[data-contact-form]')
    if (!form) return
    const inputStep = document.querySelector('[data-step="input"]')
    const confirmStep = document.querySelector('[data-step="confirm"]')
    const steps = document.querySelectorAll('.p-steps li')
    const summary = form.querySelector('.p-form__summary')
    // フォームの表示・「JavaScript が必要です」の非表示は、描画前に付く .js クラスで CSS が切り替える

    // 採用ページから来たら種別を「採用について」にしておく
    const type = new URLSearchParams(location.search).get('type')
    const preset = type && [...form.querySelectorAll('input[name="type"]')].find((r) => r.value === type)
    if (preset) preset.checked = true

    const rules = {
      type: (f) => (f.querySelector('input[name="type"]:checked') ? '' : 'お問い合わせ種別を選んでください'),
      name: (f) => (f.elements.name.value.trim() ? '' : 'お名前を入力してください'),
      email: (f) => {
        const v = f.elements.email.value.trim()
        if (!v) return 'メールアドレスを入力してください'
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'メールアドレスの形式が正しくありません（例: name@example.com）'
      },
      tel: (f) => {
        const v = f.elements.tel.value.trim()
        return !v || /^[0-9０-９+\-－() ]{10,16}$/.test(v) ? '' : '電話番号は数字とハイフンで入力してください'
      },
      file: (f) => {
        const file = f.elements.file.files[0]
        return !file || file.size <= 10 * 1024 * 1024 ? '' : '添付できるファイルは 10MB までです'
      },
      message: (f) => (f.elements.message.value.trim() ? '' : 'お問い合わせ内容を入力してください'),
      agree: (f) => (f.elements.agree.checked ? '' : '個人情報の取り扱いへの同意が必要です'),
    }

    const setInvalid = (name, invalid) => {
      const targets = name === 'type' ? form.querySelectorAll('input[name="type"]') : [form.elements[name]]
      targets.forEach((el) => el.setAttribute('aria-invalid', String(invalid)))
    }
    const check = (name) => {
      const message = rules[name](form)
      document.getElementById(`${name}-error`).textContent = message
      setInvalid(name, !!message)
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
      const targets = name === 'type' ? form.querySelectorAll('input[name="type"]') : [form.elements[name]]
      targets.forEach((el) => {
        const choice = ['radio', 'checkbox', 'file'].includes(el.type)
        el.addEventListener(choice ? 'change' : 'blur', () => check(name))
        if (!choice) el.addEventListener('input', () => el.getAttribute('aria-invalid') === 'true' && check(name))
      })
    })

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
        const ul = summary.querySelector('ul')
        ul.replaceChildren(
          ...errors.map(([name, m]) => {
            const li = document.createElement('li')
            li.dataset.for = name
            const a = document.createElement('a')
            a.href = `#${name === 'type' ? 'type-first' : name}`
            a.textContent = m
            li.append(a)
            return li
          }),
        )
        summary.focus()
        return
      }
      summary.hidden = true
      const rows = [
        [label('type'), form.querySelector('input[name="type"]:checked').closest('label').textContent.trim()],
        [label('company'), form.elements.company.value.trim() || '（未入力）'],
        [label('name'), form.elements.name.value.trim()],
        [label('email'), form.elements.email.value.trim()],
        [label('tel'), form.elements.tel.value.trim() || '（未入力）'],
        [label('file'), form.elements.file.files[0]?.name || '（なし）'],
        [label('message'), form.elements.message.value.trim()],
      ]
      confirmStep.querySelector('tbody').replaceChildren(
        ...rows.map(([k, v]) => {
          const tr = document.createElement('tr')
          const th = document.createElement('th')
          const td = document.createElement('td')
          th.scope = 'row'
          th.textContent = k
          td.textContent = v // 入力内容は textContent で入れる（HTML として解釈しない）
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
    initDrawer()
    initReveal()
    initCount()
    initNewsFilter()
    initTabs()
    initContact()
  } catch (error) {
    document.documentElement.classList.remove('js')
    console.error(error)
  }
})()
