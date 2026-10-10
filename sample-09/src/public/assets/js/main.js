// ページ共通の処理。ビルドせずそのままコピーされる（クライアントが file:// で開いても動くよう、モジュールにしない）
// 機能ごとに関数を分け、対象の要素がないページでは何もしない
;(() => {
  'use strict'

  window.siteReady = true // head の「3秒で .js を外す」保険を止める
  // 回線が遅く、保険で .js が外れたあとに読み込まれた場合も、ここで付け直す
  document.documentElement.classList.add('js')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // sessionStorage はプライベートブラウズなどで使えないことがあるので、失敗しても止まらないようにする
  const store = {
    get(key) {
      try {
        return JSON.parse(sessionStorage.getItem(key))
      } catch {
        return null
      }
    },
    set(key, value) {
      try {
        sessionStorage.setItem(key, JSON.stringify(value))
      } catch {}
    },
    remove(key) {
      try {
        sessionStorage.removeItem(key)
      } catch {}
    },
  }

  // ===== 計測 =====
  // イベントは window.dataLayer に送る。GA4 への送り方（どのイベントをコンバージョンにするか等）は
  // Google タグ マネージャー側で決めるので、ここでは「何が起きたか」だけを決まった名前で送る。一覧は README の「計測」
  window.dataLayer = window.dataLayer || []
  const debug = initDebug()
  function track(event, params = {}) {
    const payload = { event, ...params }
    window.dataLayer.push(payload)
    debug?.log(payload)
  }

  // 広告から来たときの UTM パラメータを、そのセッションの間だけ覚えておく（申し込みの完了時にいっしょに送る）
  function initUtm() {
    const params = new URLSearchParams(location.search)
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
    const utm = Object.fromEntries(keys.filter((k) => params.get(k)).map((k) => [k, params.get(k).slice(0, 100)]))
    if (Object.keys(utm).length) store.set('bk_utm', utm)
  }

  // ===== 計測の確認モード（URL に ?debug=1 を付けると、送ったイベントを画面の左下に出す） =====
  // 一度付けたらそのタブの間は続く（完了ページでも確認できるように）。?debug=0 で終わる
  function initDebug() {
    const q = new URLSearchParams(location.search).get('debug')
    if (q === '1') store.set('bk_debug', true)
    if (q === '0') store.remove('bk_debug')
    if (!store.get('bk_debug')) return null

    const panel = document.createElement('aside')
    panel.className = 'p-debug'
    panel.setAttribute('aria-label', '計測の確認')
    panel.innerHTML =
      '<div class="p-debug__head"><span>計測の確認（dataLayer）</span>' +
      '<button type="button" data-debug-min aria-expanded="true">たたむ</button>' +
      '<button type="button" data-debug-off>終了</button></div>' +
      '<div class="p-debug__list"><p class="p-debug__empty">ページを操作すると、送ったイベントがここに出ます。</p></div>'
    document.body.append(panel)
    const list = panel.querySelector('.p-debug__list')
    const min = panel.querySelector('[data-debug-min]')
    min.addEventListener('click', () => {
      const folded = panel.classList.toggle('is-min')
      min.textContent = folded ? 'ひらく' : 'たたむ'
      min.setAttribute('aria-expanded', String(!folded))
    })
    panel.querySelector('[data-debug-off]').addEventListener('click', () => {
      store.remove('bk_debug')
      panel.remove()
    })
    return {
      log(payload) {
        list.querySelector('.p-debug__empty')?.remove()
        const { event, ...params } = payload
        const item = document.createElement('div')
        item.className = 'p-debug__item'
        const name = document.createElement('b')
        name.textContent = event
        const detail = document.createElement('span')
        detail.textContent = Object.keys(params).length ? JSON.stringify(params) : '（パラメータなし）'
        item.append(name, detail)
        list.prepend(item)
      },
    }
  }

  // ===== スクロールしたらヘッダーに境界線 =====
  function initHeader() {
    const header = document.querySelector('.l-header')
    if (!header) return
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8)
    window.addEventListener('scroll', update, { passive: true })
    update()
  }

  // ===== スマホの追従ボタン（最初の画面を過ぎたら出し、申し込みフォームが見えたら隠す） =====
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

  // ===== キャンペーンの締切 =====
  // data-deadline に締切の日時（例: 2026-10-31T23:59:59+09:00）を書く。
  // デモでは "month-end"（今月末の 23:59）にしている。締切を過ぎたら、キャンペーンの表示を消して通常価格に戻す
  function initCampaign() {
    const source = document.querySelector('[data-deadline]')
    if (!source) return
    const value = source.dataset.deadline
    const now = new Date()
    const deadline = value === 'month-end' ? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) : new Date(value)
    if (Number.isNaN(deadline.getTime())) return

    if (now > deadline) {
      document.body.setAttribute('data-campaign-ended', '')
      document.querySelectorAll('[data-campaign], [data-campaign-only]').forEach((el) => (el.hidden = true))
      document.querySelectorAll('[data-price]').forEach((el) => (el.textContent = Number(el.dataset.normal).toLocaleString('ja-JP')))
      return
    }
    const week = ['日', '月', '火', '水', '木', '金', '土']
    const label = `${deadline.getMonth() + 1}月${deadline.getDate()}日（${week[deadline.getDay()]}）`
    document.querySelectorAll('[data-deadline-text]').forEach((el) => (el.textContent = label))
    // 残りの日数（当日は「本日まで」）
    const left = document.querySelector('[data-deadline-left]')
    if (left) {
      const days = Math.ceil((deadline - now) / 86400000) - 1
      left.textContent = days <= 0 ? '本日まで' : `あと ${days} 日`
      left.hidden = false
    }
  }

  // ===== ボタンのクリック・セクションの到達を計測する =====
  function initTracking() {
    // 申し込みボタン（data-cta に置き場所の名前を書く。同じ文言のボタンでも、どこで押されたかを分けて見られる）
    document.querySelectorAll('[data-cta]').forEach((el) =>
      el.addEventListener('click', () => {
        track('cta_click', { cta_position: el.dataset.cta, cta_text: el.textContent.trim().replace(/\s+/g, ' ') })
        if (el.dataset.plan) track('plan_select', { course_level: el.dataset.plan })
      }),
    )

    // どのセクションまで読まれたか（画面の真ん中を通ったら 1 回だけ送る）
    const sections = document.querySelectorAll('[data-section]')
    if (!sections.length || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          io.unobserve(e.target)
          track('section_view', { section_id: e.target.dataset.section })
        }),
      { rootMargin: '-50% 0px -50% 0px' },
    )
    sections.forEach((s) => io.observe(s))
  }

  // ===== 受講料のボタンで選んだコースを、申し込みフォームに入れておく =====
  function initPlanButtons() {
    const form = document.querySelector('[data-trial-form]')
    if (!form) return
    document.querySelectorAll('[data-plan]').forEach((el) =>
      el.addEventListener('click', () => {
        const radio = form.querySelector(`input[name="level"][value="${el.dataset.plan}"]`)
        if (radio) {
          radio.checked = true
          radio.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }),
    )
  }

  // ===== よくある質問（開閉をなめらかにし、開いた質問を計測する） =====
  function initFaq() {
    document.querySelectorAll('.c-faq').forEach((details) => {
      const summary = details.querySelector('summary')
      const body = details.querySelector('.c-faq__body')
      summary.addEventListener('click', (e) => {
        if (!details.open) track('faq_open', { faq_question: summary.textContent.trim() })
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

  // ===== 学習プランの目安 =====
  // 修了までの週数 = コースの標準時間 ÷（1日の分数 × 週の日数）を切り上げ
  function initPlanSim() {
    const root = document.querySelector('[data-plan-sim]')
    if (!root) return
    const form = root.querySelector('form')
    const weeksEl = root.querySelector('[data-result="weeks"]')
    const dateEl = root.querySelector('[data-result="date"]')
    const status = root.querySelector('[data-plan-status]')
    form.hidden = false // JS が動かないときは入力欄を出さず、例の結果だけを見せる
    root.querySelector('[data-plan-example]').hidden = true
    form.addEventListener('submit', (e) => e.preventDefault())

    let announceTimer
    let trackTimer
    const update = (user = true) => {
      const level = form.querySelector('input[name="level"]:checked')
      const hours = Number(level.dataset.hours)
      const min = Number(form.elements.min.value)
      const days = Number(form.elements.days.value)
      root.querySelector('[data-out="min"]').textContent = `${min} 分`
      root.querySelector('[data-out="days"]').textContent = `${days} 日`
      form.elements.min.setAttribute('aria-valuetext', `1日 ${min} 分`)
      form.elements.days.setAttribute('aria-valuetext', `週 ${days} 日`)
      const weeks = Math.ceil((hours * 60) / (min * days))
      const end = new Date()
      end.setDate(end.getDate() + weeks * 7)
      const date = `${end.getFullYear()}年${end.getMonth() + 1}月ごろ`
      weeksEl.textContent = weeks
      dateEl.textContent = date
      if (!user) return
      // スライダーを動かしている間は読み上げ・計測をせず、止まってから 1 回だけにする
      clearTimeout(announceTimer)
      clearTimeout(trackTimer)
      announceTimer = setTimeout(() => (status.textContent = `約 ${weeks} 週間、${date}にカリキュラムを1周できます`), 600)
      trackTimer = setTimeout(
        () => track('plan_simulate', { course_level: level.value, minutes_per_day: min, days_per_week: days, weeks }),
        1200,
      )
    }
    form.addEventListener('input', () => update())
    update(false) // 読み込み時は読み上げ・計測しない
  }

  // ===== 無料体験の申し込みフォーム =====
  function initTrialForm() {
    const form = document.querySelector('[data-trial-form]')
    if (!form) return
    // JS が動くときだけ送信できるようにし、入力チェックはブラウザ標準ではなくこの下の rules で行う
    form.querySelector('button[type="submit"]').disabled = false

    const rules = {
      name: () => (form.elements.name.value.trim() ? '' : 'お名前を入力してください'),
      email: () => {
        const v = form.elements.email.value.trim()
        if (!v) return 'メールアドレスを入力してください'
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'メールアドレスの形式が正しくありません（例: name@example.jp）'
      },
      level: () => (form.querySelector('input[name="level"]:checked') ? '' : '目指す級を選んでください'),
      agree: () => (form.elements.agree.checked ? '' : '個人情報の取り扱いへの同意が必要です'),
    }
    // エラーの印。級はラジオボタンそれぞれに aria-invalid を付け、見た目用にまとまり（fieldset）に data-invalid を付ける
    const levelGroup = form.querySelector('fieldset[aria-describedby="f-level-error"]')
    const setInvalid = (name, invalid) => {
      const els = name === 'level' ? [...form.querySelectorAll('input[name="level"]')] : [form.elements[name]]
      els.forEach((el) => (invalid ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid')))
      if (name === 'level') levelGroup.toggleAttribute('data-invalid', invalid)
    }
    const check = (name) => {
      const message = rules[name]()
      document.getElementById(`f-${name}-error`).textContent = message
      setInvalid(name, !!message)
      return message
    }

    // 入力し終えた項目からその場で確認する。エラーが出ている項目は入力中にも確認し、直った時点で消す
    // 空のまま離れただけではエラーを出さない（空の確認は送信時に行う）
    ;['name', 'email'].forEach((name) => {
      const el = form.elements[name]
      el.addEventListener('blur', () => el.value.trim() && check(name))
      el.addEventListener('input', () => el.hasAttribute('aria-invalid') && check(name))
    })
    form.querySelectorAll('input[name="level"]').forEach((r) =>
      r.addEventListener('change', () => levelGroup.hasAttribute('data-invalid') && check('level')),
    )
    form.elements.agree.addEventListener('change', () => check('agree'))

    // 入力を始めたら 1 回だけ計測する（フォームまで来たのに送らなかった人の割合を見るため）
    form.addEventListener('focusin', () => track('form_start', { form_id: 'trial' }), { once: true })

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const errors = Object.keys(rules).filter((name) => check(name))
      if (errors.length) {
        // どの項目でつまずいたかを計測する（入力した内容は送らない）
        track('form_error', { form_id: 'trial', error_fields: errors.join(',') })
        const first = errors[0]
        ;(first === 'level' ? form.querySelector('input[name="level"]') : form.elements[first]).focus()
        return
      }
      const level = form.querySelector('input[name="level"]:checked').value
      track('form_submit', { form_id: 'trial', course_level: level })
      // デモのため送信しない（名前・メールアドレスはどこにも保存しない）。
      // 完了ページでコンバージョンを 1 回だけ送るための印として、級だけを残す
      store.set('bk_lead', { level })
      location.href = 'thanks.html'
    })
  }

  // ===== 申し込みの完了ページ =====
  // フォームから来たときだけ generate_lead（GA4 の推奨イベント名）を送る。
  // 印はすぐ消すので、再読み込みやブックマークから開いても二重に数えない
  function initThanks() {
    if (!document.querySelector('[data-thanks]')) return
    const lead = store.get('bk_lead')
    if (!lead) return
    store.remove('bk_lead')
    const names = { 3: '3級', 2: '2級', '3-2': '3級', undecided: '3級' }
    const wrap = document.querySelector('[data-thanks-level]')
    wrap.querySelector('[data-thanks-level-name]').textContent = names[lead.level] || '3級'
    wrap.hidden = false
    track('generate_lead', { form_id: 'trial', course_level: lead.level, ...(store.get('bk_utm') || {}) })
  }

  // 何かで失敗しても、隠した要素が出ないままにならないようにする
  try {
    initUtm()
    initHeader()
    initFixedCta()
    initReveal()
    initCampaign()
    initTracking()
    initPlanButtons()
    initFaq()
    initPlanSim()
    initTrialForm()
    initThanks()
  } catch (error) {
    document.documentElement.classList.remove('js')
    console.error(error)
  }
})()
