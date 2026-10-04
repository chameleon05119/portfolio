// ページ共通の処理。ビルドせずそのままコピーされる（クライアントが file:// で開いても動くよう、モジュールにしない）
// 機能ごとに関数を分け、対象の要素がないページでは何もしない
;(() => {
  'use strict'

  window.siteReady = true // head の「3秒で .js を外す」保険を止める
  // 回線が遅く、保険で .js が外れたあとに読み込まれた場合も、ここで付け直す
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
    const cta = document.querySelector('[data-last-cta]')
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
            el.textContent = Math.round(to * (1 - (1 - p) ** 3)).toLocaleString('ja-JP')
            if (p < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        })
      },
      { threshold: 0.6 },
    )
    // 画面に入る前は 0 にしておく（JS が動かないときは最終値のまま見える）。
    // 最初から画面に見えている数字（最初の画面）は、0 が一瞬見えたり読まれたりしないよう、そのまま表示する
    targets.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) return
      el.textContent = '0'
      io.observe(el)
    })
  }

  // ===== 最初の画面の動き（お店の名前の帯・スマホの投稿・通知）をまとめて止める =====
  function initMotionToggle() {
    const button = document.querySelector('[data-motion-toggle]')
    if (!button || reduceMotion) return // 動きを減らす設定では最初から止まっているので出さない
    const fv = button.closest('.p-fv')
    button.hidden = false
    button.addEventListener('click', () => {
      const paused = fv.classList.toggle('is-paused')
      button.textContent = paused ? '動きを再開する' : '動きを止める'
    })
  }

  // ===== スマホの画面イメージの中で、投稿が流れ続ける =====
  function initFeed() {
    const feed = document.querySelector('[data-feed]')
    if (!feed || reduceMotion) return
    // 同じ投稿をもう 1 組並べ、半分まで流したら最初に戻す（切れ目が見えない）
    feed.append(...[...feed.children].map((el) => el.cloneNode(true)))
    feed.classList.add('is-looping')
  }

  // ===== 業種ごとの使い方のタブ（WAI-ARIA の Tabs パターン） =====
  function initTabs() {
    const root = document.querySelector('[data-tabs]')
    if (!root) return
    const list = root.querySelector('[role="tablist"]')
    const tabs = [...list.querySelectorAll('[role="tab"]')]
    const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'))
    list.hidden = false // JS が動かないときはタブを出さず、すべての業種を並べて見せる

    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab
        t.setAttribute('aria-selected', String(on))
        t.tabIndex = on ? 0 : -1
        const panel = panelOf(t)
        panel.hidden = !on
        if (on && !reduceMotion) {
          panel.classList.remove('is-entering')
          void panel.offsetWidth // アニメーションをやり直す
          panel.classList.add('is-entering')
        }
      })
      if (focus) tab.focus()
    }
    tabs.forEach((tab, i) => {
      panelOf(tab).tabIndex = 0 // パネルの中に操作できる要素がないので、パネル自体に Tab で移れるように
      tab.addEventListener('click', () => select(tab))
      tab.addEventListener('keydown', (e) => {
        const next = {
          ArrowRight: tabs[(i + 1) % tabs.length],
          ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
          Home: tabs[0],
          End: tabs[tabs.length - 1],
        }[e.key]
        if (!next) return
        e.preventDefault()
        select(next, true)
      })
    })
    select(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0])
  }

  // ===== 効果シミュレーター =====
  // 架空の計算式: 表示回数 = フォロワー × 週の投稿数 × 4.3 週 × 1.15 × 業種ごとの係数（100 回単位）
  //               浮く時間 = 週の投稿数 × 4.3 週 × 1 投稿 25 分
  function initSimulator() {
    const root = document.querySelector('[data-sim]')
    if (!root) return
    const form = root.querySelector('form')
    const reachEl = root.querySelector('[data-result="reach"]')
    const timeEl = root.querySelector('[data-result="time"]')
    const status = root.querySelector('[data-sim-status]')
    form.hidden = false // JS が動かないときは入力欄を出さず、例の結果だけを見せる
    root.querySelector('[data-sim-example]').hidden = true
    form.addEventListener('submit', (e) => e.preventDefault())

    const shown = { reach: Number(reachEl.textContent.replace(/,/g, '')), time: Number(timeEl.textContent) }
    const format = { reach: (v) => (Math.round(v / 100) * 100).toLocaleString('ja-JP'), time: (v) => v.toFixed(1) }
    const frames = {}
    const animate = (key, el, to) => {
      cancelAnimationFrame(frames[key])
      const from = shown[key]
      shown[key] = to
      if (reduceMotion) {
        el.textContent = format[key](to)
        return
      }
      const start = performance.now()
      const step = (now) => {
        const p = Math.min(1, (now - start) / 500)
        el.textContent = format[key](from + (to - from) * (1 - (1 - p) ** 3))
        if (p < 1) frames[key] = requestAnimationFrame(step)
      }
      frames[key] = requestAnimationFrame(step)
    }

    let timer
    const update = (announce = true) => {
      const followers = Number(form.elements.followers.value)
      const posts = Number(form.elements.posts.value)
      const rate = Number(form.elements.kind.value)
      root.querySelector('[data-out="followers"]').textContent = `${followers.toLocaleString('ja-JP')} 人`
      root.querySelector('[data-out="posts"]').textContent = `${posts} 回`
      // スライダーの読み上げに単位を付ける
      form.elements.followers.setAttribute('aria-valuetext', `${followers.toLocaleString('ja-JP')} 人`)
      form.elements.posts.setAttribute('aria-valuetext', `週 ${posts} 回`)
      const reach = Math.round((followers * posts * 4.3 * 1.15 * rate) / 100) * 100
      const time = Math.round(((posts * 4.3 * 25) / 60) * 10) / 10
      animate('reach', reachEl, reach)
      animate('time', timeEl, time)
      if (!announce) return
      // スライダーを動かしている間は読み上げず、止まってから結果を 1 回だけ伝える
      clearTimeout(timer)
      timer = setTimeout(() => {
        status.textContent = `1 か月の表示回数は約 ${reach.toLocaleString('ja-JP')} 回、浮く作業時間は月 ${time.toFixed(1)} 時間です`
      }, 600)
    }
    form.addEventListener('input', () => update())
    update(false) // 読み込み時は読み上げない
  }

  // ===== 導入事例のスライダー（自動では進めない） =====
  function initSlider() {
    const root = document.querySelector('[data-slider]')
    if (!root) return
    const track = root.querySelector('[data-slider-track]')
    const slides = [...track.children]
    const ctrl = root.querySelector('[data-slider-ctrl]')
    const prev = root.querySelector('[data-slider-prev]')
    const next = root.querySelector('[data-slider-next]')
    const dots = [...ctrl.querySelectorAll('.p-cases__dots button')]
    if (slides.length < 2) return
    ctrl.hidden = false

    const current = () => Math.round(track.scrollLeft / (slides[1].offsetLeft - slides[0].offsetLeft))
    const go = (i) => track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' })
    const sync = () => {
      const c = current()
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === c)))
      // disabled にすると、押したボタンが端で押せなくなった瞬間にフォーカスが外れるので aria-disabled にする
      prev.setAttribute('aria-disabled', String(c === 0))
      next.setAttribute('aria-disabled', String(c === slides.length - 1))
      // 見えていないスライドは読み上げ・Tab の対象から外す
      slides.forEach((s, i) => (s.inert = i !== c))
    }
    prev.addEventListener('click', () => current() > 0 && go(current() - 1))
    next.addEventListener('click', () => current() < slides.length - 1 && go(current() + 1))
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)))
    let raf
    track.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(sync)
      },
      { passive: true },
    )
    sync()
  }

  // ===== 無料登録・資料ダウンロード・ご相談のモーダル =====
  // ボタンの command="show-modal" でブラウザが開く。ここでは押したボタンに合わせて文言と項目を切り替える
  function initSignup() {
    const dialog = document.querySelector('[data-dialog]')
    if (!dialog) return
    const form = dialog.querySelector('[data-signup-form]')
    // JS が動くときだけ送信できるようにし、入力チェックはブラウザ標準ではなくこの下の rules で行う
    form.noValidate = true
    form.querySelector('button[type="submit"]').disabled = false
    const inputStep = dialog.querySelector('[data-dialog-step="input"]')
    const doneStep = dialog.querySelector('[data-dialog-step="done"]')
    const modes = {
      trial: {
        title: '30 日間、無料でためす',
        lead: 'クレジットカードの登録は不要です。',
        submit: '無料で始める',
        doneTitle: 'ご登録ありがとうございます',
        doneText: '確認メールをお送りしました。メール内のボタンから設定を始めてください。',
      },
      doc: {
        title: '資料ダウンロード',
        lead: '「3 分でわかる ミセルポ」をメールでお送りします。',
        submit: '資料を受け取る',
        doneTitle: '資料をお送りしました',
        doneText: 'ご登録のメールアドレスに、資料のダウンロードリンクをお送りしました。',
      },
      consult: {
        title: 'オンライン相談のお申し込み',
        lead: '30 分ほど、画面を見ながら使い方をご案内します。',
        submit: '相談を申し込む',
        doneTitle: 'お申し込みありがとうございます',
        doneText: '担当者から 1 営業日以内に、日程のご案内をメールでお送りします。',
      },
    }

    // command 属性に対応していないブラウザでは、ここで開く
    const supportsCommand = 'command' in HTMLButtonElement.prototype
    document.querySelectorAll('[data-open]').forEach((button) =>
      button.addEventListener('click', () => {
        setMode(button.dataset.open)
        if (!supportsCommand) dialog.showModal()
      }),
    )
    if (!supportsCommand)
      dialog.querySelectorAll('[command="close"]').forEach((b) => b.addEventListener('click', () => dialog.close()))

    // 背景（ダイアログの外）を押したら閉じる。押し始めも外だったときだけ
    // （入力欄の文字をドラッグで選んで外で離したときや、上の色の帯を押したときに閉じないように）
    const outside = (e) => {
      const r = dialog.getBoundingClientRect()
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    }
    let downOutside = false
    dialog.addEventListener('pointerdown', (e) => (downOutside = e.target === dialog && outside(e)))
    dialog.addEventListener('click', (e) => {
      if (downOutside && e.target === dialog && outside(e)) dialog.close()
      downOutside = false
    })

    function setMode(key) {
      const mode = modes[key] || modes.trial
      dialog.dataset.mode = key
      dialog.querySelectorAll('[data-mode-text]').forEach((el) => (el.textContent = mode[el.dataset.modeText]))
      dialog.querySelectorAll('[data-mode-only]').forEach((el) => (el.hidden = el.dataset.modeOnly !== key))
      // 開くたびに最初の状態に戻す
      form.reset()
      Object.keys(rules).forEach((name) => clearError(name))
      inputStep.hidden = false
      doneStep.hidden = true
      dialog.setAttribute('aria-labelledby', 'signup-title')
    }

    const rules = {
      shop: () => (form.elements.shop.value.trim() ? '' : 'お店の名前を入力してください'),
      kind: () => (form.elements.kind.value ? '' : '業種を選んでください'),
      email: () => {
        const v = form.elements.email.value.trim()
        if (!v) return 'メールアドレスを入力してください'
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'メールアドレスの形式が正しくありません（例: shop@example.jp）'
      },
      agree: () => (form.elements.agree.checked ? '' : '個人情報の取り扱いへの同意が必要です'),
    }
    // エラーの印。業種はラジオボタンそれぞれに aria-invalid を付け、見た目用にまとまり（fieldset）に data-invalid を付ける
    const kindGroup = form.querySelector('fieldset[aria-describedby="f-kind-error"]')
    const setInvalid = (name, invalid) => {
      const els = name === 'kind' ? [...form.querySelectorAll('input[name="kind"]')] : [form.elements[name]]
      els.forEach((el) => (invalid ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid')))
      if (name === 'kind') kindGroup.toggleAttribute('data-invalid', invalid)
    }
    const clearError = (name) => {
      document.getElementById(`f-${name}-error`).textContent = ''
      setInvalid(name, false)
    }
    const check = (name) => {
      const message = rules[name]()
      document.getElementById(`f-${name}-error`).textContent = message
      setInvalid(name, !!message)
      return message
    }

    // 入力し終えた項目からその場で確認する。エラーが出ている項目は入力中にも確認し、直った時点で消す
    // （フォーカスが外れた瞬間にエラー文が消えると下の要素がずれ、次に押そうとしたボタンを押し損ねるため）
    // 空のまま離れただけではエラーを出さない（開いた直後に最初の欄にフォーカスがあるため、
    // 送信ボタンを押した瞬間に「未入力」が出て下の要素がずれ、ボタンを押し損ねる）。空の確認は送信時に行う
    ;['shop', 'email'].forEach((name) =>
      form.elements[name].addEventListener('blur', () => form.elements[name].value.trim() && check(name)),
    )
    ;['shop', 'email'].forEach((name) =>
      form.elements[name].addEventListener('input', () => form.elements[name].hasAttribute('aria-invalid') && check(name)),
    )
    form.querySelectorAll('input[name="kind"]').forEach((r) => r.addEventListener('change', () => check('kind')))
    form.elements.agree.addEventListener('change', () => check('agree'))

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const errors = Object.keys(rules).filter((name) => check(name))
      if (errors.length) {
        // 最初のエラーの項目へ移動する（エラー文は aria-describedby で読み上げられる）
        const first = errors[0]
        ;(first === 'kind' ? form.querySelector('input[name="kind"]') : form.elements[first]).focus()
        return
      }
      // デモのため送信しない（入力内容はどこにも保存しない）
      inputStep.hidden = true
      doneStep.hidden = false
      dialog.setAttribute('aria-labelledby', 'signup-done-title') // ダイアログの名前も完了の見出しにする
      doneStep.querySelector('h2').focus()
    })
  }

  // 何かで失敗しても、隠した要素が出ないままにならないようにする
  try {
    initHeader()
    initFixedCta()
    initReveal()
    initCount()
    initMotionToggle()
    initFeed()
    initTabs()
    initSimulator()
    initSlider()
    initSignup()
  } catch (error) {
    document.documentElement.classList.remove('js')
    console.error(error)
  }
})()
