// ページ共通の処理。ビルドせずそのままコピーされる（file:// で開いても動くよう、モジュールにしない）
// 機能ごとに関数を分け、対象の要素がなければ何もしない
;(() => {
  'use strict'

  // 遅い回線で head の保険が外した場合に備えて付け直す
  document.documentElement.classList.add('js')
  window.siteReady = true

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  // ===== スクロールでふわっと表示・数字のカウントアップ =====
  function initReveal() {
    const items = document.querySelectorAll('.js-reveal')
    if (!items.length) return
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-in')
          entry.target.querySelectorAll('.js-count').forEach(countUp)
          io.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    items.forEach((el) => io.observe(el))
  }

  // HTML には最終の数字を書いておき、動かすときだけ 0 から数える（読み上げは最終の数字のまま）
  function countUp(el) {
    if (reduceMotion.matches) return
    const to = Number(el.dataset.to)
    const decimals = Number(el.dataset.decimals || 0)
    const start = performance.now()
    const duration = 1200
    el.setAttribute('aria-hidden', 'true')
    const label = document.createElement('span')
    label.className = 'u-visually-hidden'
    label.textContent = el.textContent
    el.after(label)
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      el.textContent = (to * (1 - Math.pow(1 - t, 3))).toFixed(decimals)
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  // ===== スマホのメニュー（<dialog>） =====
  function initMenu() {
    const dialog = document.querySelector('.js-menu')
    const openButton = document.querySelector('.js-menu-open')
    if (!dialog || !openButton || typeof dialog.showModal !== 'function') return
    openButton.hidden = false
    openButton.addEventListener('click', () => dialog.showModal())
    dialog.querySelector('.js-menu-close').addEventListener('click', () => dialog.close())
    // 背景（::backdrop）を押したら閉じる
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close()
    })
    // ページ内リンクを押したら、閉じてからその場所へ移動する
    dialog.querySelectorAll('a[href^="#"]').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault()
        dialog.close()
        const target = document.querySelector(a.getAttribute('href'))
        if (target) {
          target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' })
          // 閉じるとフォーカスはメニューボタンに戻るので、移動先に移して次の Tab が続きから進むようにする
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
          target.focus({ preventScroll: true })
          history.replaceState(null, '', a.getAttribute('href'))
        }
      }),
    )
  }

  // ===== お悩みチェック → 答えを光らせる =====
  function initWorry() {
    document.querySelectorAll('.js-worry').forEach((button) => {
      const answer = document.getElementById(button.dataset.target)
      if (!answer) return
      // 光っていることを読み上げでも分かるよう、答えの頭に「あてはまる：」を足す
      const mark = document.createElement('span')
      mark.className = 'u-visually-hidden'
      mark.textContent = 'あてはまる：'
      button.addEventListener('click', () => {
        const on = button.getAttribute('aria-pressed') !== 'true'
        button.setAttribute('aria-pressed', String(on))
        answer.classList.toggle('is-hit', on)
        if (on) answer.querySelector('a').prepend(mark.cloneNode(true))
        else answer.querySelector('a > .u-visually-hidden')?.remove()
      })
    })
  }

  // ===== タブ（1日の流れ・募集要項） =====
  // JS が動かないときはタブの列を隠したまま、パネルを全部見せる
  function initTabs() {
    document.querySelectorAll('.js-tabs').forEach((root) => {
      const list = root.querySelector('[role="tablist"]')
      const tabs = Array.from(root.querySelectorAll('[role="tab"]'))
      if (!list || !tabs.length) return
      list.hidden = false
      // タブ名と同じ見出しは、タブが使えるときは読み上げでも重複するので隠す
      root.querySelectorAll('.c-tabs__fallback').forEach((h) => (h.hidden = true))

      const select = (tab, focus) => {
        tabs.forEach((t) => {
          const on = t === tab
          t.setAttribute('aria-selected', String(on))
          t.tabIndex = on ? 0 : -1
          document.getElementById(t.getAttribute('aria-controls')).hidden = !on
        })
        if (focus) tab.focus()
        const timeline = document.getElementById(tab.getAttribute('aria-controls')).querySelector('.p-day__timeline')
        if (timeline) {
          timeline.classList.remove('is-animating')
          void timeline.offsetWidth // アニメーションをやり直す
          timeline.classList.add('is-animating')
        }
      }

      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(tab, false))
        tab.addEventListener('keydown', (e) => {
          const last = tabs.length - 1
          const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key]
          if (next === undefined) return
          e.preventDefault()
          select(tabs[next], true)
        })
      })
      tabs.forEach((t) => {
        document.getElementById(t.getAttribute('aria-controls')).hidden = t.getAttribute('aria-selected') !== 'true'
      })
    })
  }

  // ===== 給与の目安（数字はすべて架空） =====
  const SALARY = {
    base: [28.0, 30.0, 32.0], // 常勤の基本給（万円）: 〜3年 / 4〜9年 / 10年〜。訪問手当と合わせて募集要項の「月給31万〜35万円」になる
    visit: 3.0, // 常勤の訪問手当（万円）
    wage: [1900, 2000, 2150], // パートの時給（円）
    hours: 6, // パートの1日の勤務時間
    weeks: 4.3, // 1か月の週の数
    partVisit: 0.4, // パートの訪問手当（万円 / 週1日あたり）
    oncall: 0.3, // オンコール手当（万円 / 回）
    dispatch: 0.15, // 出動手当の目安（万円 / 回。半分くらい出動する想定）
  }
  const EXP_LABEL = ['〜3年', '4〜9年', '10年〜']

  function initSim() {
    const form = document.querySelector('.js-sim')
    if (!form) return
    const f = form.elements
    const daysField = form.querySelector('.js-sim-days')
    const totalEl = form.querySelector('.js-sim-total')
    const breakdown = form.querySelector('.js-sim-breakdown')
    const live = form.querySelector('.js-sim-live')
    const go = form.querySelector('.js-sim-go')
    let liveTimer

    const calc = () => {
      const type = f.type.value
      const exp = Number(f.exp.value)
      const oncall = Number(f.oncall.value)
      const days = Number(f.days.value)
      daysField.hidden = type !== 'part'
      form.querySelector('.js-sim-oncall-out').textContent = oncall
      form.querySelector('.js-sim-days-out').textContent = days

      const rows =
        type === 'full'
          ? [
              ['基本給', SALARY.base[exp]],
              ['訪問手当', SALARY.visit],
              ['オンコール手当', oncall * SALARY.oncall],
              ['出動手当（目安）', oncall * SALARY.dispatch],
            ]
          : [
              [`時給${SALARY.wage[exp].toLocaleString('ja-JP')}円×${SALARY.hours}時間×週${days}日`, (SALARY.wage[exp] * SALARY.hours * days * SALARY.weeks) / 10000],
              ['訪問手当', days * SALARY.partVisit],
              ['オンコール手当', oncall * SALARY.oncall],
            ]
      const total = rows.reduce((sum, [, v]) => sum + v, 0)
      totalEl.textContent = total.toFixed(1)
      breakdown.replaceChildren(
        ...rows.map(([label, v]) => {
          const li = document.createElement('li')
          li.textContent = `${label}：${v.toFixed(1)}万円`
          return li
        }),
      )
      const condition = `${type === 'full' ? '常勤' : `パート週${days}日`}・経験${EXP_LABEL[exp]}・オンコール月${oncall}回`
      go.dataset.message = `給与の目安の条件：${condition}（目安 ${total.toFixed(1)}万円）`
      // スライダーを動かすたびに読み上げないよう、止まってから伝える
      clearTimeout(liveTimer)
      liveTimer = setTimeout(() => (live.textContent = `月収の目安は ${total.toFixed(1)}万円です`), 600)
    }

    form.addEventListener('input', calc)
    form.addEventListener('submit', (e) => e.preventDefault())
    calc()
    live.textContent = ''

    // 「この条件で見学を申し込む」: 条件をフォームの質問欄に入れる
    go.addEventListener('click', () => {
      const msg = document.getElementById('entry-msg')
      if (!msg) return
      // 確認・完了の画面を出しているときは、入力の画面に戻してから書き込む
      document.dispatchEvent(new CustomEvent('entry:show-form'))
      const lines = msg.value.split('\n').filter((l) => !l.startsWith('給与の目安の条件：'))
      msg.value = [go.dataset.message, ...lines].join('\n').trim()
    })
  }

  // ===== 先輩の声の横スクロール =====
  function initVoices() {
    const root = document.querySelector('.js-voices')
    if (!root) return
    const list = root.querySelector('.js-voices-list')
    const nav = root.querySelector('.p-voices__nav')
    const prev = root.querySelector('.js-voices-prev')
    const next = root.querySelector('.js-voices-next')
    nav.hidden = false

    const step = () => list.querySelector('li').getBoundingClientRect().width + 20
    const update = () => {
      const max = list.scrollWidth - list.clientWidth - 2
      // disabled にするとフォーカスが外れるので aria-disabled にする
      prev.setAttribute('aria-disabled', String(list.scrollLeft <= 2))
      next.setAttribute('aria-disabled', String(list.scrollLeft >= max))
      nav.hidden = max <= 0
    }
    const move = (dir, button) => {
      if (button.getAttribute('aria-disabled') === 'true') return
      list.scrollBy({ left: dir * step(), behavior: reduceMotion.matches ? 'auto' : 'smooth' })
    }
    prev.addEventListener('click', () => move(-1, prev))
    next.addEventListener('click', () => move(1, next))
    list.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true })
    window.addEventListener('resize', update)
    update()
  }

  // 全角の数字・ハイフン・空白を取り除いて、半角の数字だけにする
  const normalizeTel = (v) => v.normalize('NFKC').replace(/[-‐－ー−\s()]/g, '')

  // ===== 応募フォーム（入力 → 確認 → 完了。デモのため送信しない） =====
  function initEntry() {
    const form = document.querySelector('.js-entry-form')
    if (!form) return
    const confirm = document.querySelector('.js-entry-confirm')
    const done = document.querySelector('.js-entry-done')
    const steps = Array.from(document.querySelectorAll('.js-entry-steps li'))
    const f = form.elements
    form.noValidate = true
    form.querySelector('[type="submit"]').disabled = false

    const RULES = {
      name: (v) => (v.trim() ? '' : 'お名前を入力してください'),
      tel: (v) => {
        const digits = normalizeTel(v)
        if (!digits) return '電話番号を入力してください'
        return /^0\d{9,10}$/.test(digits) ? '' : '電話番号は、0から始まる10〜11けたの数字で入力してください'
      },
      mail: (v) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'メールアドレスの形を確認してください（例: name@example.jp）'),
    }
    const summary = form.querySelector('.js-entry-summary')
    const check = (name) => {
      const input = f[name]
      const message = RULES[name](input.value)
      input.setAttribute('aria-invalid', String(Boolean(message)))
      document.getElementById(`${input.id}-error`).textContent = message
      return !message
    }
    // 入力中は、すでにエラーが出ている項目だけ確かめ直す（直った時点で消す）
    Object.keys(RULES).forEach((name) =>
      f[name].addEventListener('input', () => {
        if (f[name].getAttribute('aria-invalid') === 'true') check(name)
      }),
    )
    // 入力がある項目は、フォーカスが外れたときに確かめる（空のまま外れても出さない）
    ;['tel', 'mail'].forEach((name) =>
      f[name].addEventListener('blur', () => {
        if (f[name].value.trim()) check(name)
      }),
    )

    const setStep = (n) =>
      steps.forEach((li, i) => {
        li.classList.toggle('is-done', i < n)
        li.querySelector('.u-visually-hidden')?.remove()
        if (i < n) li.insertAdjacentHTML('beforeend', '<span class="u-visually-hidden">（済み）</span>')
        if (i === n) li.setAttribute('aria-current', 'step')
        else li.removeAttribute('aria-current')
      })
    const show = (el) => {
      ;[form, confirm, done].forEach((x) => (x.hidden = x !== el))
      el.closest('.p-entry').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' })
      const heading = el.querySelector('h3')
      if (heading) heading.focus({ preventScroll: true })
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const results = Object.keys(RULES).map(check)
      const errors = results.filter((r) => !r).length
      summary.textContent = errors ? `${errors}件の入力を確認してください` : ''
      if (errors) {
        form.querySelector('[aria-invalid="true"]').focus()
        return
      }
      f.tel.value = normalizeTel(f.tel.value) // 全角の数字やハイフンを半角の数字だけにそろえる
      const times = Array.from(form.querySelectorAll('[name="time"]:checked')).map((x) => x.value)
      const rows = [
        ['お申し込みの内容', f.kind.value],
        ['希望の働き方', f.style.value],
        ['お名前', f.name.value],
        ['ふりがな', f.kana.value || '（未入力）'],
        ['電話番号', f.tel.value],
        ['メールアドレス', f.mail.value || '（未入力）'],
        ['連絡のつきやすい時間', times.join('・') || '（指定なし）'],
        ['ご質問・ご希望', f.msg.value || '（なし）'],
      ]
      confirm.querySelector('.js-entry-list').replaceChildren(
        ...rows.flatMap(([k, v]) => {
          const dt = document.createElement('dt')
          const dd = document.createElement('dd')
          dt.textContent = k
          dd.textContent = v // textContent なので入力内容がタグとして解釈されることはない
          return [dt, dd]
        }),
      )
      setStep(1)
      show(confirm)
    })

    document.addEventListener('entry:show-form', () => {
      if (!form.hidden) return
      setStep(0)
      ;[form, confirm, done].forEach((x) => (x.hidden = x !== form))
    })
    done.querySelector('.js-entry-reset').addEventListener('click', () => {
      form.reset()
      summary.textContent = ''
      setStep(0)
      show(form)
    })
    confirm.querySelector('.js-entry-back').addEventListener('click', () => {
      setStep(0)
      show(form)
      f.name.focus({ preventScroll: true })
    })
    confirm.querySelector('.js-entry-send').addEventListener('click', () => {
      setStep(2)
      show(done)
    })
  }

  // ===== スマホの固定ボタン: 応募フォームが見えている間は隠す =====
  function initFixbar() {
    const bar = document.querySelector('.js-fixbar')
    const entry = document.getElementById('entry')
    if (!bar || !entry || !('IntersectionObserver' in window)) return
    new IntersectionObserver(([e]) => bar.classList.toggle('is-hidden', e.isIntersecting), { threshold: 0.05 }).observe(entry)
  }

  const init = () => {
    initReveal()
    initMenu()
    initWorry()
    initTabs()
    initSim()
    initVoices()
    initEntry()
    initFixbar()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
