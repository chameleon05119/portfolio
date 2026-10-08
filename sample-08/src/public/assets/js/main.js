// ページ共通の処理。ビルドせずそのままコピーされる（クライアントが file:// で開いても動くよう、モジュールにしない）
// 診療時間・休診日・症状のデータは data.js（window.CLINIC）。機能ごとに関数を分け、対象の要素がないページでは何もしない
;(() => {
  'use strict'
  window.siteReady = true // head の保険（3秒で .js を外す）を止める
  document.documentElement.classList.add('js') // 遅い回線で保険が先に .js を外していたら付け直す

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const DAYS = ['日', '月', '火', '水', '木', '金', '土']
  const COLS = [1, 2, 3, 4, 5, 6, 0] // 表の列の並び（月〜土、最後に日・祝）

  // ===== data.js の読み込みと確認 =====
  // 書き間違いはコンソールに警告を出して、その項目だけ使わない（ほかの表示は続ける）
  const CLINIC = loadClinic(window.CLINIC)

  function loadClinic(raw) {
    const warn = (msg) => console.warn(`data.js: ${msg}`)
    const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00`))
    const isTime = (s) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s)
    if (!raw) {
      warn('読み込めませんでした（ファイルがないか、書き方が壊れています）')
      return null
    }
    const slots = (raw.slots || []).filter((s) => {
      const ok = s && s.name && isTime(s.from) && isTime(s.to) && isTime(s.last) && Array.isArray(s.days)
      if (!ok) warn(`slots の書き方が違います: ${JSON.stringify(s)}`)
      return ok
    })
    const names = slots.map((s) => s.name)
    const closed = (raw.closed || []).filter((c) => {
      const ok = c && isDate(c.date) && (!c.slots || c.slots.every((n) => names.includes(n)))
      if (!ok) warn(`closed の書き方が違います（日付は 'YYYY-MM-DD'、slots は ${names.join('・')}）: ${JSON.stringify(c)}`)
      return ok
    })
    const holidays = (raw.holidays || []).filter((d) => {
      if (!isDate(d)) warn(`holidays の日付の書き方が違います（'YYYY-MM-DD'）: ${d}`)
      return isDate(d)
    })
    const parts = raw.parts || []
    const diseases = (raw.diseases || []).filter((d) => {
      const ok = d && d.name && parts.some((p) => p.id === d.part) && Array.isArray(d.symptoms)
      if (!ok) warn(`diseases の書き方が違います（part は ${parts.map((p) => p.id).join('・')}）: ${JSON.stringify(d)}`)
      return ok
    })
    return { slots, openBefore: Number(raw.openBefore) || 0, closed, holidays, parts, symptoms: raw.symptoms || [], diseases }
  }

  // ===== 日付・時刻の共通処理 =====
  // 時刻は日本時間で判定する（海外の端末や、端末の時間帯の設定に左右されない）
  const jstFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
  function nowJST() {
    const p = Object.fromEntries(jstFormat.formatToParts(new Date()).map((x) => [x.type, Number(x.value)]))
    return new Date(p.year, p.month - 1, p.day, p.hour % 24, p.minute)
  }
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const parseDate = (s) => new Date(`${s}T00:00`) // 'YYYY-MM-DD' だけだと UTC として読まれ、日付がずれることがある
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
  const toMin = (s) => {
    const [h, m] = s.split(':').map(Number)
    return h * 60 + m
  }
  const fromMin = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
  const hm = (s) => s.replace(/^0/, '') // '09:00' → '9:00'
  const dateJa = (d) => `${d.getMonth() + 1}月${d.getDate()}日（${DAYS[d.getDay()]}）`

  const closedEntry = (d) => CLINIC.closed.find((c) => c.date === ymd(d))
  const isHoliday = (d) => CLINIC.holidays.includes(ymd(d))
  // 臨時休診で休みになる枠の名前（1 日休みなら全部）
  const closedSlotNames = (d) => {
    const c = closedEntry(d)
    return c ? c.slots || CLINIC.slots.map((s) => s.name) : []
  }
  // その日に開いている診療枠（祝日・臨時休診を除く）
  const slotsOn = (d) => (isHoliday(d) ? [] : CLINIC.slots.filter((s) => s.days.includes(d.getDay()) && !closedSlotNames(d).includes(s.name)))
  // 次に診療がある日と最初の枠（2 週間先まで）
  function nextOpen(from) {
    for (let i = 1; i <= 14; i++) {
      const d = addDays(from, i)
      const s = slotsOn(d)[0]
      if (s) return { d, s, i }
    }
    return null
  }

  // ===== スマホ・タブレットのメニュー =====
  function initDrawer() {
    const button = document.querySelector('.l-header__menu')
    const drawer = document.getElementById('drawer')
    if (!button || !drawer) return
    // メニューを開いている間は、背面（本文・フッター・予約バー）を操作できないようにする
    const behind = ['main', 'footer', '.u-skip', '.l-alert', '.l-demo', '.l-fixbar'].map((s) => document.querySelector(s)).filter(Boolean)

    let hideTimer = 0
    const open = () => {
      clearTimeout(hideTimer) // 閉じている途中で開き直したときに、あとから非表示にされないように
      drawer.hidden = false
      button.setAttribute('aria-expanded', 'true')
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
    // ナビを横に並べる幅になったら閉じる
    window.matchMedia('(min-width: 1360px)').addEventListener('change', (e) => {
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

  // ===== 診療時間・休診日の文（フッター・メニュー・注記） =====
  //   data-clinic-text="hours"  … 9:00〜12:00 ／ 15:00〜18:30
  //   data-clinic-text="closed" … 木曜・土曜午後・日曜・祝日
  //   data-clinic-text="last"   … 受付は終了の 15 分前まで
  function initClinicText() {
    const texts = {
      hours: CLINIC.slots.map((s) => `${hm(s.from)}〜${s.to}`).join(' ／ '),
      closed: closedDaysText(),
      last: (() => {
        const before = CLINIC.slots.map((s) => toMin(s.to) - toMin(s.last))
        return before.every((b) => b === before[0]) ? `受付は終了の ${before[0]} 分前まで` : `受付は ${CLINIC.slots.map((s) => `${s.name} ${s.last}`).join('・')} まで`
      })(),
    }
    document.querySelectorAll('[data-clinic-text]').forEach((el) => {
      const t = texts[el.dataset.clinicText]
      if (t) el.textContent = t
    })
  }
  function closedDaysText() {
    const list = []
    COLS.forEach((d) => {
      const open = CLINIC.slots.filter((s) => s.days.includes(d))
      if (!open.length) list.push(`${DAYS[d]}曜`)
      else if (open.length < CLINIC.slots.length) list.push(`${DAYS[d]}曜${CLINIC.slots.filter((s) => !open.includes(s)).map((s) => s.name).join('・')}`)
    })
    return [...list, '祝日'].join('・')
  }

  // ===== 診療時間表・担当医表 =====
  //   <div data-hours="time"></div>   診療時間（●／休診）
  //   <div data-hours="doctor"></div> 担当医
  //   data-hours-today="false" で今日の列を強調しない
  // 中に書いてある文は、JS が動かないときの代わり（表が作れたら置き換える）
  function initHoursTables() {
    const roots = document.querySelectorAll('[data-hours]')
    if (!roots.length || !CLINIC.slots.length) return
    const now = nowJST()
    const todayCol = isHoliday(now) ? 0 : now.getDay() // 祝日は「日祝」の列を今日にする
    const closedNow = closedSlotNames(now)
    const sr = (t) => `<span class="u-visually-hidden">${t}</span>`

    roots.forEach((root) => {
      const type = root.dataset.hours
      const markToday = root.dataset.hoursToday !== 'false'
      const table = document.createElement('table')
      table.className = `c-hours c-hours--${type}`
      const cap = table.createCaption()
      cap.className = 'u-visually-hidden'
      cap.textContent = type === 'doctor' ? '曜日ごとの担当医' : '曜日ごとの診療時間'
      const head = table.createTHead().insertRow()
      const corner = document.createElement('th')
      corner.innerHTML = sr(type === 'doctor' ? '時間帯' : '診療時間')
      head.append(corner)
      COLS.forEach((d) => {
        const th = document.createElement('th')
        th.scope = 'col'
        th.textContent = d === 0 ? '日祝' : DAYS[d]
        if (d === 0) th.classList.add('is-sun')
        if (markToday && d === todayCol) {
          th.classList.add('is-today')
          th.insertAdjacentHTML('beforeend', sr('（今日）'))
        }
        head.append(th)
      })
      const body = table.createTBody()
      CLINIC.slots.forEach((slot) => {
        const row = body.insertRow()
        const th = document.createElement('th')
        th.scope = 'row'
        th.innerHTML = type === 'doctor' ? slot.name : `${sr(`${slot.name} `)}<span class="u-num">${hm(slot.from)}</span>〜<span class="u-num">${slot.to}</span>`
        row.append(th)
        COLS.forEach((d) => {
          const cell = row.insertCell()
          const isToday = markToday && d === todayCol
          if (isToday) cell.classList.add('is-today')
          // 今日が臨時休診の枠は「休」にする
          const closedToday = isToday && closedNow.includes(slot.name)
          const doctor = slot.doctors?.[d]
          if (closedToday) {
            cell.innerHTML = `<span aria-hidden="true">休</span>${sr('本日は臨時休診')}`
            cell.classList.add('is-off')
          } else if (type === 'doctor') {
            cell.textContent = doctor || '休'
            cell.classList.add(doctor ? 'is-name' : 'is-off')
          } else if (slot.days.includes(d)) {
            cell.innerHTML = `<span aria-hidden="true">●</span>${sr('診療')}`
            cell.classList.add('is-on')
          } else {
            cell.innerHTML = `<span aria-hidden="true">／</span>${sr('休診')}`
            cell.classList.add('is-off')
          }
        })
      })
      root.replaceChildren(table)
    })
  }

  // ===== 今日の受付状況（「午前の受付中」「本日の受付は終了」など）。1 分ごとに更新 =====
  function initToday() {
    const roots = document.querySelectorAll('[data-today]')
    if (!roots.length || !CLINIC.slots.length) return
    const update = () => {
      const now = nowJST()
      const min = now.getHours() * 60 + now.getMinutes()
      const slots = slotsOn(now)
      const cur = slots.find((s) => min >= toMin(s.from) - CLINIC.openBefore && min <= toMin(s.last))
      const later = slots.find((s) => min < toMin(s.from) - CLINIC.openBefore)
      let status
      let note
      let state // open: 受付中 / wait: このあと受付 / closed: 休み・終了
      if (cur) {
        ;[status, note, state] = [`${cur.name}の受付中`, `受付は ${cur.last} まで`, 'open']
      } else if (later) {
        ;[status, note, state] = [`${later.name}は ${hm(later.from)} から`, `受付は ${fromMin(toMin(later.from) - CLINIC.openBefore)} から`, 'wait']
      } else {
        const reason = closedEntry(now)?.reason || (isHoliday(now) ? '祝日' : '')
        const next = nextOpen(now)
        const nextText = next ? `${next.i === 1 ? '明日は' : `次は ${dateJa(next.d)}`} ${hm(next.s.from)} から` : ''
        // 今日診療した枠があれば「受付は終了」（午後だけ臨時休診の日の午後も含む）、1 つもなければ「休診」
        status = slots.length ? '本日の受付は終了' : '本日休診'
        note = [reason, nextText].filter(Boolean).join('／')
        state = 'closed'
      }
      roots.forEach((root) => {
        root.querySelector('[data-today-date]').textContent = dateJa(now)
        const badge = root.querySelector('[data-today-status]')
        badge.textContent = status
        badge.dataset.state = state
        root.querySelector('[data-today-note]').textContent = note
        root.hidden = false
      })
    }
    update()
    setInterval(update, 60 * 1000)
    // 開きっぱなしのタブに戻ってきたときにも更新する
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && update())
  }

  // ===== 臨時休診の帯（2 週間以内のものだけ） =====
  function initClosedAlert() {
    const alert = document.querySelector('[data-closed-alert]')
    if (!alert) return
    const today = parseDate(ymd(nowJST()))
    const soon = CLINIC.closed
      .map((c) => ({ ...c, d: parseDate(c.date) }))
      .filter((c) => c.d >= today && (c.d - today) / 864e5 <= 14)
      .sort((a, b) => a.d - b.d)[0]
    if (!soon) return
    const which = soon.slots ? `の${soon.slots.join('・')}` : ''
    alert.querySelector('[data-closed-alert-text]').textContent = `${dateJa(soon.d)}${which}は、${soon.reason}休診します`
    alert.hidden = false
  }

  // ===== タブ（矢印キー・Home・End でも切り替え） =====
  function initTabs() {
    document.querySelectorAll('[role="tablist"]').forEach((list) => {
      const tabs = [...list.querySelectorAll('[role="tab"]')]
      const select = (tab, focus) => {
        tabs.forEach((t) => {
          const on = t === tab
          t.setAttribute('aria-selected', String(on))
          t.tabIndex = on ? 0 : -1
          document.getElementById(t.getAttribute('aria-controls')).hidden = !on
        })
        if (focus) tab.focus()
      }
      // JS が動かないときは両方の表を出しておき、ここで選ばれていないほうを隠す
      select(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0])
      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(tab))
        tab.addEventListener('keydown', (e) => {
          const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
          if (to === undefined) return
          e.preventDefault()
          select(tabs[(to + tabs.length) % tabs.length], true)
        })
      })
    })
  }

  // ===== 症状から探す =====
  // 「場所」は 1 つだけ選ぶラジオボタン（矢印キーで移動）。からだの図の丸はマウス・タッチ用の近道で、同じ状態を持つ
  // 「症状」はいくつでも選べるトグルボタン。選んだ症状のどれかに当てはまる病気を出す
  let finderCount = 0
  function initFinder() {
    if (!CLINIC.parts.length) return
    document.querySelectorAll('[data-finder]').forEach((root) => {
      const n = ++finderCount
      const map = root.querySelector('[data-finder-map]')
      const partsEl = root.querySelector('[data-finder-parts]')
      const symsEl = root.querySelector('[data-finder-syms]')
      const result = root.querySelector('[data-finder-result]')
      const status = root.querySelector('[data-finder-status]')
      // 同じページに 2 つ置いても id が重ならないようにする
      root.querySelectorAll('[id^="finder-"]').forEach((el) => {
        const id = `${el.id}-${n}`
        root.querySelectorAll(`[aria-labelledby="${el.id}"]`).forEach((x) => x.setAttribute('aria-labelledby', id))
        el.id = id
      })
      let part = CLINIC.parts.some((p) => p.id === root.dataset.finderPart) ? root.dataset.finderPart : CLINIC.parts.find((p) => p.id === 'back')?.id || CLINIC.parts[0].id
      const picked = new Set(CLINIC.symptoms.includes('痛い') ? ['痛い'] : [])

      const el = (tag, cls, text) => {
        const e = document.createElement(tag)
        if (cls) e.className = cls
        if (text) e.textContent = text
        return e
      }
      partsEl.setAttribute('role', 'radiogroup')
      CLINIC.parts.forEach((p) => {
        const spot = el('span', 'p-finder__spot')
        spot.dataset.part = p.id
        spot.style.left = `${p.x}%`
        spot.style.top = `${p.y}%`
        spot.title = p.name
        map.append(spot)
        const radio = el('button', 'c-chip', p.name)
        radio.type = 'button'
        radio.setAttribute('role', 'radio')
        radio.dataset.part = p.id
        partsEl.append(radio)
      })
      CLINIC.symptoms.forEach((s) => {
        const b = el('button', 'c-chip c-chip--check', s)
        b.type = 'button'
        b.dataset.sym = s
        symsEl.append(b)
      })

      root.addEventListener('click', (e) => {
        const t = e.target.closest('[data-part], [data-sym]')
        if (!t) return
        if (t.dataset.part) part = t.dataset.part
        else picked.has(t.dataset.sym) ? picked.delete(t.dataset.sym) : picked.add(t.dataset.sym)
        render()
      })
      // ラジオボタンの矢印キー操作（選ぶと同時に移動）
      partsEl.addEventListener('keydown', (e) => {
        const radios = [...partsEl.querySelectorAll('[role="radio"]')]
        const i = radios.findIndex((r) => r.dataset.part === part)
        const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: radios.length - 1 }[e.key]
        if (to === undefined) return
        e.preventDefault()
        part = radios[(to + radios.length) % radios.length].dataset.part
        render()
        partsEl.querySelector(`[data-part="${part}"]`).focus()
      })

      function render() {
        partsEl.querySelectorAll('[role="radio"]').forEach((r) => {
          const on = r.dataset.part === part
          r.setAttribute('aria-checked', String(on))
          r.tabIndex = on ? 0 : -1
        })
        map.querySelectorAll('[data-part]').forEach((s) => s.classList.toggle('is-selected', s.dataset.part === part))
        symsEl.querySelectorAll('[data-sym]').forEach((b) => b.setAttribute('aria-pressed', String(picked.has(b.dataset.sym))))

        const name = CLINIC.parts.find((p) => p.id === part).name
        const hits = CLINIC.diseases.filter((d) => d.part === part && (!picked.size || d.symptoms.some((s) => picked.has(s))))
        const quoted = [...picked].map((s) => `「${s}」`).join('')
        const cond = !picked.size ? `${name}の` : picked.size === 1 ? `${name}が${quoted}とき、考えられる` : `${name}が${quoted}のどれかに当てはまるとき、考えられる`

        result.replaceChildren()
        if (hits.length) {
          const h = el('h3', '', `${cond}主な病気`)
          h.append(el('span', 'u-num', String(hits.length)), '件')
          const ul = el('ul')
          hits.forEach((d) => {
            const li = el('li')
            if (d.page) {
              const a = el('a', '', d.name)
              a.href = d.page
              li.append(a)
            } else li.append(el('span', '', d.name))
            ul.append(li)
          })
          result.append(h, ul)
        } else {
          result.append(el('p', 'p-finder__empty', 'この組み合わせに当てはまる病気は登録されていません。症状を変えるか、受診してご相談ください。'))
        }
        // 結果は短い文で読み上げる（一覧をまるごと読ませない）
        status.textContent = `${name}（${[...picked].join('・') || '症状の指定なし'}）：${hits.length ? `${hits.length}件` : '該当なし'}`
      }

      render()
      // 作れたら、JS が動かないときの代わりの案内と入れ替える
      root.querySelector('[data-finder-fallback]')?.remove()
      root.querySelectorAll('[data-finder-ui]').forEach((x) => (x.hidden = false))
    })
  }

  // ダイアログの外（暗い部分）を押したかどうか。中の余白を押しても閉じないように、位置で判定する
  const clickedOutside = (dialog, e) => {
    const r = dialog.getBoundingClientRect()
    return e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
  }

  // ===== デモの Web 予約（ダイアログ。JS が動かないときは「初めての方へ」の予約の説明へ移動） =====
  function initReserve() {
    const dialog = document.getElementById('reserve-dialog')
    if (!dialog || typeof dialog.showModal !== 'function') return
    let opener = null
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-reserve]')
      if (!link) return
      e.preventDefault()
      opener = link
      dialog.showModal()
    })
    dialog.addEventListener('click', (e) => clickedOutside(dialog, e) && dialog.close())
    dialog.addEventListener('close', () => opener?.focus())
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

  // ===== 写真の拡大表示 =====
  function initLightbox() {
    const grid = document.querySelector('[data-lightbox]')
    const dialog = document.querySelector('.p-lightbox')
    if (!grid || !dialog || typeof dialog.showModal !== 'function') return
    const img = dialog.querySelector('img')
    const caption = dialog.querySelector('p')
    let opener = null
    grid.addEventListener('click', async (e) => {
      const button = e.target.closest('button')
      if (!button) return
      opener = button
      const thumb = button.querySelector('img')
      // srcset のいちばん大きい画像を拡大表示に使う。読み込んでから開く（開いた直後に大きさが変わらないように）
      img.src = thumb.srcset.split(',').map((c) => c.trim().split(/\s+/)[0]).pop() || thumb.currentSrc || thumb.src
      caption.textContent = thumb.alt // 写真の説明はキャプションで読ませる（img の alt は空にして二重に読ませない）
      await img.decode().catch(() => {})
      dialog.showModal()
    })
    dialog.querySelector('button').addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', (e) => clickedOutside(dialog, e) && dialog.close())
    dialog.addEventListener('close', () => opener?.focus())
  }

  // ===== 記事の目次: 今読んでいる見出しを示す =====
  function initToc() {
    const links = [...document.querySelectorAll('.p-toc a')]
    if (!links.length || !('IntersectionObserver' in window)) return
    const set = (hash) => links.forEach((a) => (a.hash === hash ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')))
    set(links[0].hash)
    const sections = links.map((a) => document.querySelector(a.hash)).filter(Boolean)
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && set(`#${e.target.id}`)), { rootMargin: '-20% 0px -70% 0px' })
    sections.forEach((s) => io.observe(s))
    // ページの最後まで来たら、最後の見出しを示す（短い最後の項目は上の判定の帯に入らないことがある）
    window.addEventListener(
      'scroll',
      () => {
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) set(links.at(-1).hash)
      },
      { passive: true },
    )
  }

  // 何かで失敗しても、隠した要素が出ないままにならないようにする
  // 機能ごとに失敗を閉じ込め、1つ失敗してもほかは動かす。表示に関わる initReveal が失敗したら全部表示する
  // data.js が読めないときは、診療時間・症状から探すは HTML に書いた代わりの文のまま
  const clinicFeatures = CLINIC ? [initClinicText, initHoursTables, initToday, initClosedAlert, initFinder] : []
  ;[initDrawer, ...clinicFeatures, initTabs, initReserve, initNewsFilter, initLightbox, initToc].forEach((init) => {
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
