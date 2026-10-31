// ページ共通の処理。ビルドせずそのままコピーされる（file:// で開いても動くよう、モジュールにしない）
// 機能ごとに関数を分け、対象の要素がなければ何もしない。商品LP・記事LP の両方で読み込む
;(() => {
  'use strict'

  // 遅い回線で head の保険が外した場合に備えて付け直す
  document.documentElement.classList.add('js')
  window.siteReady = true

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const yen = (n) => n.toLocaleString('ja-JP')
  const smooth = () => (reduceMotion.matches ? 'auto' : 'smooth')

  // ===== 計測（GTM がある想定で dataLayer に積むだけ。デモでは送信先なし） =====
  window.dataLayer = window.dataLayer || []
  const track = (event, params = {}) => window.dataLayer.push({ event, ...params })

  // ===== スクロールでふわっと表示 =====
  function initReveal() {
    const items = document.querySelectorAll('.js-reveal')
    if (!items.length) return
    if (!('IntersectionObserver' in window) || reduceMotion.matches) {
      items.forEach((el) => el.classList.add('is-in'))
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
    items.forEach((el) => io.observe(el))
  }

  // ===== メニューの絞り込み =====
  function initMenuFilter() {
    const bar = document.querySelector('.js-menu-filter')
    if (!bar) return
    const cards = document.querySelectorAll('.p-menu__card')
    const status = document.querySelector('.js-menu-status')
    bar.hidden = false
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button')
      if (!b) return
      bar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      let n = 0
      cards.forEach((c) => {
        c.hidden = !(b.dataset.filter === 'all' || c.dataset.kind === b.dataset.filter)
        if (!c.hidden) {
          n++
          c.classList.add('is-in') // 絞り込みで出たカードは、ふわっと表示を待たずに見せる
        }
      })
      status.textContent = ''
      requestAnimationFrame(() => (status.textContent = `${b.textContent}: ${n}品を表示しています`))
    })
  }

  // ===== セットと価格: 定期便／1回だけ =====
  const SET_NAMES = { trial: 'お試し4食', 6: '6食', 10: '10食' }
  const setPrice = (set, mode) => {
    const el = document.querySelector(`.p-set[data-set="${set}"]`)
    return Number(set === 'trial' ? el.dataset.sub : el.dataset[mode])
  }

  function initSets() {
    const modeBar = document.querySelector('.js-set-mode')
    if (!modeBar) return
    const status = document.querySelector('.js-set-status')
    modeBar.hidden = false
    const render = (mode) => {
      document.querySelectorAll('.p-set').forEach((card) => {
        if (card.dataset.set === 'trial') return
        const price = Number(card.dataset[mode])
        card.querySelector('.js-set-price').textContent = yen(price)
        card.querySelector('.js-set-per').textContent = yen(Math.round(price / Number(card.dataset.meals)))
        card.querySelector('.js-set-kind').textContent = mode === 'sub' ? '定期 ' : ''
        card.querySelector('.js-set-off').textContent = mode === 'sub' ? `1回だけより ${yen(Number(card.dataset.one) - Number(card.dataset.sub))}円お得` : '定期便にすると、もっとお得です'
      })
      status.textContent = ''
      requestAnimationFrame(() => (status.textContent = mode === 'sub' ? '定期便の価格を表示しています' : '1回だけの価格を表示しています'))
    }
    modeBar.addEventListener('click', (e) => {
      const b = e.target.closest('button')
      if (!b) return
      modeBar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      render(b.dataset.mode)
      const form = document.querySelector('.js-entry-form')
      if (form && form.elements.set.value !== 'trial') {
        form.elements.mode.value = b.dataset.mode
        form.dispatchEvent(new Event('change'))
      }
    })
    // フォームの買い方を変えたら（リセットも含む）価格表の切り替えもそろえる
    document.addEventListener('entry:mode', (e) => {
      const b = modeBar.querySelector(`[data-mode="${e.detail}"]`)
      if (b.getAttribute('aria-pressed') === 'true') return
      modeBar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      render(e.detail)
    })

    // 「このセットを選ぶ」→ フォームのセット・買い方を合わせてから移動する
    document.querySelectorAll('[data-pick]').forEach((a) =>
      a.addEventListener('click', () => {
        const form = document.querySelector('.js-entry-form')
        if (!form) return
        document.dispatchEvent(new Event('entry:show-form'))
        const mode = modeBar.querySelector('[aria-pressed="true"]').dataset.mode
        form.elements.set.value = a.dataset.pick
        if (a.dataset.pick !== 'trial') form.elements.mode.value = mode
        form.dispatchEvent(new Event('change'))
        track('select_set', { set: a.dataset.pick, mode })
      }),
    )
  }

  // ===== お届けスケジュール（すべて架空のルール） =====
  // 製造 = 注文の翌日以降の最初の平日、発送 = 製造の翌日以降の最初の平日、お届け = 発送の翌日
  const DW = ['月', '火', '水', '木', '金', '土', '日']
  const isWeekday = (d) => d % 7 < 5
  const nextWeekday = (d) => {
    d++
    while (!isWeekday(d)) d++
    return d
  }
  const schedule = (o) => {
    const make = nextWeekday(o)
    const ship = nextWeekday(make)
    return { make, ship, arrive: ship + 1 }
  }

  function initSchedule() {
    const box = document.querySelector('.js-sched')
    if (!box) return
    const days = box.querySelector('.js-sched-days')
    const strip = box.querySelector('.js-sched-strip')
    const result = box.querySelector('.js-sched-result')
    box.hidden = false
    document.querySelector('.js-sched-table').open = false // 操作できるときは一覧表を閉じておく

    // 今日の曜日を最初に選んでおく（月曜 = 0）
    const today = (new Date().getDay() + 6) % 7
    days.innerHTML = DW.map(
      (w, i) => `<button type="button" class="${i === 5 ? 'is-sat' : i === 6 ? 'is-sun' : ''}" data-d="${i}" aria-pressed="${i === today}">${w}<span class="u-visually-hidden">曜日</span></button>`,
    ).join('')

    const render = (o) => {
      const { make, ship, arrive } = schedule(o)
      const cells = []
      for (let d = o; d < o + 8; d++) {
        let cls = ''
        let ev = ''
        if (d === o) [cls, ev] = ['is-order', '注文']
        else if (d === make) ev = '製造'
        else if (d === ship) [cls, ev] = ['is-ship', '発送']
        else if (d === arrive) [cls, ev] = ['is-arrive', 'お届け']
        else if (!isWeekday(d) && d < arrive) [cls, ev] = ['is-off', '休み']
        cells.push(`<li class="${cls}"><b>${DW[d % 7]}</b><span>${ev}</span></li>`)
      }
      strip.innerHTML = cells.join('')
      const lag = arrive - o
      result.innerHTML = `${DW[o]}曜日のご注文は、<b>${DW[arrive % 7]}曜日</b>にお届け（${lag}日後）`
    }
    render(today)
    days.addEventListener('click', (e) => {
      const b = e.target.closest('button')
      if (!b) return
      days.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
      render(Number(b.dataset.d))
    })
  }

  // 全角の数字・ハイフン・空白を取り除いて、半角の数字だけにする
  const digitsOnly = (v) => v.normalize('NFKC').replace(/[-‐－ー−\s()]/g, '')

  // ===== 申し込みフォーム（入力 → 確認 → 完了。デモのため送信しない） =====
  function initEntry() {
    const form = document.querySelector('.js-entry-form')
    if (!form) return
    const confirm = document.querySelector('.js-entry-confirm')
    const done = document.querySelector('.js-entry-done')
    const steps = Array.from(document.querySelectorAll('.js-entry-steps li'))
    const total = form.querySelector('.js-entry-total')
    const modeField = form.querySelector('.js-entry-mode')
    const f = form.elements
    form.noValidate = true
    form.querySelector('[type="submit"]').disabled = false

    // セット・買い方に合わせて金額を出す。お試しは定期便にならないので買い方を選べなくする
    const updateTotal = () => {
      const isTrial = f.set.value === 'trial'
      modeField.disabled = isTrial
      total.textContent = yen(setPrice(f.set.value, f.mode.value))
      if (!isTrial) document.dispatchEvent(new CustomEvent('entry:mode', { detail: f.mode.value }))
    }
    form.addEventListener('change', updateTotal)
    updateTotal()

    const RULES = {
      name: (v) => (v.trim() ? '' : 'お名前を入力してください'),
      zip: (v) => {
        const d = digitsOnly(v)
        if (!d) return '郵便番号を入力してください'
        return /^\d{7}$/.test(d) ? '' : '郵便番号は7けたの数字で入力してください'
      },
      tel: (v) => {
        const d = digitsOnly(v)
        if (!d) return '電話番号を入力してください'
        return /^0\d{9,10}$/.test(d) ? '' : '電話番号は、0から始まる10〜11けたの数字で入力してください'
      },
      address: (v) => (v.trim() ? '' : 'ご住所を入力してください'),
      mail: (v) => {
        if (!v.trim()) return 'メールアドレスを入力してください'
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'メールアドレスの形を確認してください（例: name@example.jp）'
      },
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
    // 形の決まった項目は、入力があればフォーカスが外れたときに確かめる
    ;['zip', 'tel', 'mail'].forEach((name) =>
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
      document.querySelector('.p-entry__steps').scrollIntoView({ behavior: smooth(), block: 'start' })
      const heading = el.querySelector('h3')
      if (heading) heading.focus({ preventScroll: true })
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const errors = Object.keys(RULES).map(check).filter((ok) => !ok).length
      summary.textContent = errors ? `${errors}件の入力を確認してください` : ''
      if (errors) {
        form.querySelector('[aria-invalid="true"]').focus()
        return
      }
      f.tel.value = digitsOnly(f.tel.value)
      const zip = digitsOnly(f.zip.value)
      f.zip.value = `${zip.slice(0, 3)}-${zip.slice(3)}`
      const isTrial = f.set.value === 'trial'
      const rows = [
        ['セット', `${SET_NAMES[f.set.value]}（${isTrial ? 'はじめての方 1回限り' : f.mode.value === 'sub' ? '定期便' : '1回だけ'}）`],
        ['お支払い金額', `${yen(setPrice(f.set.value, f.mode.value))}円（税込・送料込）`],
        ['お名前', f.name.value],
        ['ふりがな', f.kana.value || '（未入力）'],
        ['お届け先', `〒${f.zip.value} ${f.address.value}`],
        ['電話番号', f.tel.value],
        ['メールアドレス', f.mail.value],
        ['お届けの希望', f.when.value],
        ['お支払い方法', '代金引換'],
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
      track('order_confirm', { set: f.set.value, mode: isTrial ? 'trial' : f.mode.value })
    })

    // 「このセットを選ぶ」から来たときは、確認・完了画面を入力画面に戻す
    document.addEventListener('entry:show-form', () => {
      if (!form.hidden) return
      setStep(0)
      ;[form, confirm, done].forEach((x) => (x.hidden = x !== form))
    })
    done.querySelector('.js-entry-reset').addEventListener('click', () => {
      form.reset()
      updateTotal()
      document.dispatchEvent(new CustomEvent('entry:mode', { detail: 'sub' }))
      summary.textContent = ''
      setStep(0)
      show(form)
      f.name.focus({ preventScroll: true }) // 入力画面には見出しがないので、最初の入力欄へ
    })
    confirm.querySelector('.js-entry-back').addEventListener('click', () => {
      setStep(0)
      show(form)
      f.name.focus({ preventScroll: true })
    })
    confirm.querySelector('.js-entry-send').addEventListener('click', () => {
      setStep(2)
      show(done)
      track('order_complete_demo', { set: f.set.value })
    })
  }

  // ===== スマホの固定ボタン: 最初の画面を過ぎたら出し、申し込み欄が見えている間は隠す =====
  function initFixbar() {
    const bar = document.querySelector('.js-fixbar')
    const hero = document.querySelector('.p-hero')
    const order = document.getElementById('order')
    if (!bar || !hero || !order) return
    if (!('IntersectionObserver' in window)) {
      bar.classList.remove('is-hidden')
      return
    }
    let pastHero = false
    let atOrder = false
    const update = () => bar.classList.toggle('is-hidden', !pastHero || atOrder)
    new IntersectionObserver(([e]) => {
      pastHero = !e.isIntersecting
      update()
    }).observe(hero)
    new IntersectionObserver(
      ([e]) => {
        atOrder = e.isIntersecting
        update()
      },
      { threshold: 0.05 },
    ).observe(order)
  }

  // ===== 記事LP: 3問の診断 → 比較表の列を目立たせる =====
  const TYPES = {
    A: { name: 'まとめ買い型', why: '冷凍庫に余裕があり、よく使う方は、一度にたくさん届くほうが1回あたりの手間が少なくなります。' },
    B: { name: '少しずつ定期型', why: '冷凍庫に余裕がない方・まず試したい方は、4〜10食ずつ届き、お休みもしやすい型が続けやすいです。' },
    C: { name: '主菜だけ型', why: '副菜は自分で作れる方・1食の安さを大事にしたい方は、主菜だけの型がむだがありません。' },
  }
  function initQuiz() {
    const quiz = document.querySelector('.js-quiz')
    if (!quiz) return
    const result = quiz.querySelector('.js-quiz-result')
    const table = document.querySelector('.js-types')
    quiz.addEventListener('submit', (e) => e.preventDefault())
    quiz.addEventListener('change', () => {
      const answers = Array.from(quiz.querySelectorAll('input:checked'))
      if (answers.length < 3) {
        result.textContent = ''
        return
      }
      const score = { A: 0, B: 0, C: 0 }
      answers.forEach((a) => a.dataset.score.split(',').forEach((s) => (score[s[0]] += Number(s.slice(1)))))
      // 同点のときは、Q3（いちばん大事にしたいこと）の答えを優先する
      const q3 = quiz.querySelector('[name="q3"]:checked').dataset.score[0]
      const best = Object.keys(score).sort((x, y) => score[y] - score[x] || (y === q3) - (x === q3))[0]
      result.innerHTML = `<b>あなたに合いそうなのは「${TYPES[best].name}」</b><p>${TYPES[best].why}下の表で色がついた列を見てください。</p>`
      table.querySelectorAll('[data-type]').forEach((cell) => cell.classList.toggle('is-hit', cell.dataset.type === best))
      track('quiz_result', { type: best })
    })
  }

  // ===== CTA のクリックを記録（記事LP → 商品LP の計測用） =====
  function initCta() {
    document.querySelectorAll('[data-cta]').forEach((a) => a.addEventListener('click', () => track('cta_click', { position: a.dataset.cta })))
  }

  const init = () => {
    initReveal()
    initMenuFilter()
    initSets()
    initSchedule()
    initEntry()
    initFixbar()
    initQuiz()
    initCta()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
