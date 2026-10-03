// Figma のカンプを1回で丸ごと取得し、design/ にキャッシュする
//
//   npm run figma -- <Figma の URL> [--force]
//   npm run figma -- --export "logo-r,logo-w" [--format svg|png] [--scale 2]
//     書き出し指定のないパーツ（ロゴ・アイコンなど）を、レイヤー名で指定して追加で書き出す。
//     必要なものをまとめて1回で指定する（Tier1 を1回使う）
//
// Figma の REST API は無料プランや閲覧権限だと月6〜20回しか呼べないため、
// 1案件あたり Tier1 を最大3回（ファイル本体・フレーム画像・書き出し指定パーツ）に抑え、
// 以降の作業はすべて design/ のキャッシュを読む。
//
// 出力:
//   design/file.json            API の生データ
//   design/frames/*.png         各フレームの画像（等倍。npm run compare の比較元）
//   design/structure/*.md       各フレームの構造（位置・サイズ・テキスト・スタイル）。実装時に読む
//   design/tokens.json          色・文字・角丸・余白の使用回数（トークンの候補）
//   design/assets/              写真（画像塗り）と、デザイナーが書き出し指定したパーツ
//
// トークンは環境変数 FIGMA_TOKEN か、リポジトリの private/figma.env（FIGMA_TOKEN=...）から読む。
// 権限は file_content:read だけで足りる。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const API = 'https://api.figma.com/v1'
const OUT = resolve(process.cwd(), 'design')
let token
let fileKey

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}

if (args.includes('--export')) {
  await exportByName(option('export', '').split(',').map((n) => n.trim()).filter(Boolean), option('format', 'svg'), Number(option('scale', '1')))
  process.exit(0)
}

const force = args.includes('--force')
const url = args.find((a) => a.startsWith('http'))
if (!url) exit('使い方: npm run figma -- <Figma の URL> [--force]')

const match = url.match(/figma\.com\/(?:file|design)\/([^/?#]+)/)
if (!match) exit('Figma のファイル URL ではありません')
const urlFileKey = match[1]
const targetNodeId = new URL(url).searchParams.get('node-id')?.replace('-', ':') ?? null

if (existsSync(join(OUT, 'file.json')) && !force) {
  exit('design/file.json が既にあります。API 回数を節約するため取得し直しません（必要なら --force）')
}

token = requireToken()
fileKey = urlFileKey

// --- 1. ファイル本体（Tier1） -------------------------------------------
console.log('ファイルを取得中…')
const file = await api(`/files/${fileKey}`)
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'file.json'), JSON.stringify(file))
writeFileSync(join(OUT, 'meta.json'), JSON.stringify({ fileKey, url: url.split('?')[0], fetchedAt: new Date().toISOString() }, null, 2))

const frames = collectFrames(file.document).filter(
  (f) => !targetNodeId || f.node.id === targetNodeId || contains(f.node, targetNodeId),
)
if (frames.length === 0) exit('対象のフレームが見つかりません')
console.log(`フレーム ${frames.length} 件: ${frames.map((f) => f.node.name).join(', ')}`)

// --- 2. 写真などの画像塗り（Tier2。回数制限が緩い） ----------------------
const imageRefs = new Set()
for (const { node } of frames) walk(node, (n) => n.fills?.forEach((p) => p.type === 'IMAGE' && p.imageRef && imageRefs.add(p.imageRef)))
const imageFiles = {}
if (imageRefs.size > 0) {
  console.log(`画像塗り ${imageRefs.size} 件をダウンロード中…`)
  const { meta } = await api(`/files/${fileKey}/images`)
  mkdirSync(join(OUT, 'assets/fills'), { recursive: true })
  for (const ref of imageRefs) {
    const src = meta.images[ref]
    if (!src) continue
    const res = await fetch(src)
    const ext = extFromType(res.headers.get('content-type'))
    const name = `fills/${ref.slice(0, 12)}.${ext}`
    writeFileSync(join(OUT, 'assets', name), Buffer.from(await res.arrayBuffer()))
    imageFiles[ref] = `assets/${name}`
  }
}

// --- 3. フレーム画像（Tier1） ---------------------------------------------
console.log('フレーム画像を書き出し中…')
mkdirSync(join(OUT, 'frames'), { recursive: true })
const frameNames = uniqueNames(frames.map((f) => `${f.page}__${f.node.name}`))
await exportImages(
  frames.map((f, i) => ({ id: f.node.id, path: `frames/${frameNames[i]}.png` })),
  { format: 'png', scale: 1 },
)

// --- 4. デザイナーが書き出し指定したパーツ（Tier1、形式ごとに1回） --------
const exportables = []
for (const { node } of frames) walk(node, (n) => n !== node && n.exportSettings?.length && exportables.push(n))
const byFormat = new Map()
for (const n of exportables) {
  for (const s of n.exportSettings) {
    const scale = s.constraint?.type === 'SCALE' ? s.constraint.value : 1
    const key = `${s.format.toLowerCase()}@${scale}`
    if (!byFormat.has(key)) byFormat.set(key, [])
    byFormat.get(key).push({ n, suffix: s.suffix ?? '' })
  }
}
if (byFormat.size > 0) {
  mkdirSync(join(OUT, 'assets/export'), { recursive: true })
  for (const [key, items] of byFormat) {
    const [format, scale] = key.split('@')
    const names = uniqueNames(items.map(({ n, suffix }) => `${n.name}${suffix}${scale === '1' ? '' : `@${scale}x`}`))
    console.log(`パーツ ${items.length} 件を ${key} で書き出し中…`)
    await exportImages(
      items.map(({ n }, i) => ({ id: n.id, path: `assets/export/${names[i]}.${format}` })),
      { format, scale: Number(scale) },
    )
  }
}

// --- 5. 構造とトークン候補（API を使わない） --------------------------------
mkdirSync(join(OUT, 'structure'), { recursive: true })
frames.forEach((f, i) => {
  const lines = [`# ${f.page} / ${f.node.name}`, '', `画像: frames/${frameNames[i]}.png`, '']
  const loose = looseLayers(file.document, f)
  if (loose.length) {
    console.warn(`  注意: 「${f.node.name}」の外に、重なっているレイヤーが ${loose.length} 件（フレーム画像には写らない）`)
    lines.push('## 注意: フレームの外に置かれているが、このフレームに重なっているレイヤー', '', 'フレーム画像には写っていない。デザイナーの配置ミスの可能性が高いので、意図を確認する。', '')
    loose.forEach((n) => outline(n, f.node.absoluteBoundingBox, 0, lines))
    lines.push('', '## フレームの中身', '')
  }
  outline(f.node, f.node.absoluteBoundingBox, 0, lines)
  writeFileSync(join(OUT, 'structure', `${frameNames[i]}.md`), lines.join('\n'))
})
writeFileSync(join(OUT, 'tokens.json'), JSON.stringify(collectTokens(frames.map((f) => f.node)), null, 2))

console.log(`完了: ${OUT}`)

// ===========================================================================

function exit(message) {
  console.error(message)
  process.exit(1)
}

// 取得済みの file.json からレイヤー名でノードを探し、まとめて書き出す
async function exportByName(names, format, scale) {
  if (names.length === 0) exit('書き出すレイヤー名を指定してください')
  if (!existsSync(join(OUT, 'meta.json'))) exit('先に npm run figma -- <URL> で取得してください')
  token = requireToken()
  fileKey = JSON.parse(readFileSync(join(OUT, 'meta.json'), 'utf8')).fileKey
  const file = JSON.parse(readFileSync(join(OUT, 'file.json'), 'utf8'))
  const found = new Map()
  walk(file.document, (n) => names.includes(n.name) && !found.has(n.name) && found.set(n.name, n))
  const missing = names.filter((n) => !found.has(n))
  if (missing.length) exit(`見つからないレイヤー: ${missing.join(', ')}`)
  const fileNames = uniqueNames(names.map((n) => (scale === 1 ? n : `${n}@${scale}x`)))
  console.log(`${names.length} 件を ${format}@${scale} で書き出し中…`)
  await exportImages(
    names.map((n, i) => ({ id: found.get(n).id, path: `assets/export/${fileNames[i]}.${format}` })),
    { format, scale },
  )
  console.log('完了: design/assets/export/')
}

function requireToken() {
  const value = loadToken()
  if (!value) exit('FIGMA_TOKEN が見つかりません。private/figma.env に FIGMA_TOKEN=... を置いてください')
  return value
}

function loadToken() {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN
  for (let dir = process.cwd(); dir !== dirname(dir); dir = dirname(dir)) {
    const envFile = join(dir, 'private/figma.env')
    if (existsSync(envFile)) {
      return readFileSync(envFile, 'utf8').match(/^FIGMA_TOKEN=(.+)$/m)?.[1].trim()
    }
  }
}

async function api(path) {
  const res = await fetch(API + path, { headers: { 'X-Figma-Token': token } })
  if (res.status === 429) {
    const retry = res.headers.get('retry-after')
    exit(`Figma API の回数制限に達しました（プラン: ${res.headers.get('x-figma-plan-tier')}、再試行まで ${retry} 秒）`)
  }
  if (!res.ok) exit(`Figma API エラー ${res.status}: ${await res.text()}`)
  return res.json()
}

async function exportImages(items, { format, scale }) {
  const ids = items.map((i) => i.id).join(',')
  const { images } = await api(`/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`)
  for (const { id, path } of items) {
    if (!images[id]) {
      console.warn(`  書き出せませんでした: ${path}`)
      continue
    }
    const res = await fetch(images[id])
    mkdirSync(dirname(join(OUT, path)), { recursive: true })
    writeFileSync(join(OUT, path), Buffer.from(await res.arrayBuffer()))
  }
}

// ページ直下のフレーム（セクションの中も1段だけ見る）をカンプとして扱う
function collectFrames(document) {
  const result = []
  for (const page of document.children) {
    for (const child of page.children ?? []) {
      const candidates = child.type === 'SECTION' ? child.children ?? [] : [child]
      for (const node of candidates) {
        if (['FRAME', 'COMPONENT', 'COMPONENT_SET'].includes(node.type) && node.visible !== false) {
          result.push({ page: page.name, node })
        }
      }
    }
  }
  return result
}

// ページ直下にあってフレームに属さないのに、フレームの範囲に重なっているレイヤー
function looseLayers(document, frame) {
  const page = document.children.find((p) => p.name === frame.page)
  const f = frame.node.absoluteBoundingBox
  return (page?.children ?? []).filter((n) => {
    if (n === frame.node || n.visible === false || !n.absoluteBoundingBox || n.type === 'SECTION') return false
    if (['FRAME', 'COMPONENT', 'COMPONENT_SET'].includes(n.type)) return false
    const b = n.absoluteBoundingBox
    return b.x < f.x + f.width && b.x + b.width > f.x && b.y < f.y + f.height && b.y + b.height > f.y
  })
}

function walk(node, fn) {
  if (node.visible === false) return
  fn(node)
  node.children?.forEach((c) => walk(c, fn))
}

function contains(node, id) {
  let found = false
  walk(node, (n) => (found ||= n.id === id))
  return found
}

function uniqueNames(names) {
  const seen = new Map()
  return names.map((raw) => {
    const name = raw.replace(/[\\/:*?"<>|\s]+/g, '_')
    const count = seen.get(name) ?? 0
    seen.set(name, count + 1)
    return count === 0 ? name : `${name}_${count + 1}`
  })
}

function extFromType(type) {
  if (type?.includes('jpeg')) return 'jpg'
  if (type?.includes('gif')) return 'gif'
  if (type?.includes('webp')) return 'webp'
  return 'png'
}

function hex({ r, g, b, a = 1 }, opacity = 1) {
  const h = [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
  const alpha = Math.round(a * opacity * 100) / 100
  return alpha === 1 ? `#${h}` : `#${h} / ${alpha}`
}

function paintText(paint) {
  if (paint.visible === false) return null
  if (paint.type === 'SOLID') return hex(paint.color, paint.opacity)
  if (paint.type === 'IMAGE') return `画像(${imageFiles[paint.imageRef] ?? paint.imageRef}, ${paint.scaleMode})`
  if (paint.type.startsWith('GRADIENT')) {
    return `${paint.type.toLowerCase()}(${paint.gradientStops.map((s) => `${hex(s.color)} ${Math.round(s.position * 100)}%`).join(', ')})`
  }
  return paint.type
}

// 実装に必要な情報だけを、フレーム左上からの相対座標でインデント表示する
function outline(node, origin, depth, lines) {
  if (node.visible === false) return
  const box = node.absoluteBoundingBox
  const props = []
  if (box) {
    props.push(`x${Math.round(box.x - origin.x)} y${Math.round(box.y - origin.y)} ${Math.round(box.width)}×${Math.round(box.height)}`)
  }
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].map((v) => v ?? 0)
    props.push(`flex-${node.layoutMode === 'HORIZONTAL' ? 'row' : 'col'} gap${node.itemSpacing ?? 0} pad[${pad.join(' ')}]`)
    if (node.primaryAxisAlignItems) props.push(`justify:${node.primaryAxisAlignItems.toLowerCase()}`)
    if (node.counterAxisAlignItems) props.push(`align:${node.counterAxisAlignItems.toLowerCase()}`)
  }
  const fills = (node.fills ?? []).map(paintText).filter(Boolean)
  if (fills.length && node.type !== 'TEXT') props.push(`bg:${fills.join(' + ')}`)
  const strokes = (node.strokes ?? []).map(paintText).filter(Boolean)
  if (strokes.length) props.push(`border:${node.strokeWeight}px ${strokes.join(' ')}`)
  if (node.cornerRadius) props.push(`radius${node.cornerRadius}`)
  else if (node.rectangleCornerRadii) props.push(`radius[${node.rectangleCornerRadii.join(' ')}]`)
  if (node.opacity !== undefined && node.opacity < 1) props.push(`opacity${Math.round(node.opacity * 100) / 100}`)
  for (const e of node.effects ?? []) {
    if (e.visible === false) continue
    const spread = e.spread ? ` ${e.spread}` : ''
    if (e.type === 'DROP_SHADOW') props.push(`shadow(${e.offset.x} ${e.offset.y} ${e.radius}${spread} ${hex(e.color)})`)
    else if (e.type === 'INNER_SHADOW') props.push(`inset-shadow(${e.offset.x} ${e.offset.y} ${e.radius}${spread} ${hex(e.color)})`)
    else props.push(`${e.type.toLowerCase()}(${e.radius})`)
  }
  if (node.exportSettings?.length) props.push('[書き出し指定あり]')

  let label = `${'  '.repeat(depth)}- ${node.type} "${node.name}"`
  if (node.type === 'TEXT') {
    const s = node.style ?? {}
    const lh = s.lineHeightPx ? ` lh${Math.round(s.lineHeightPx * 10) / 10}` : ''
    const ls = s.letterSpacing ? ` ls${Math.round(s.letterSpacing * 100) / 100}` : ''
    props.push(`${s.fontFamily} ${s.fontWeight} ${s.fontSize}px${lh}${ls} ${s.textAlignHorizontal?.toLowerCase() ?? ''} ${fills.join(' ')}`.trim())
    if (node.characterStyleOverrides?.some((v) => v !== 0)) props.push('[文字ごとのスタイル違いあり]')
    label += ` ${props.join(' | ')}\n${'  '.repeat(depth + 1)}> ${node.characters.replace(/\n/g, '\n' + '  '.repeat(depth + 1) + '> ')}`
    lines.push(label)
    return
  }
  lines.push(`${label} ${props.join(' | ')}`)
  // ベクター（アイコン等）の中身は実装に不要なので潜らない
  if (['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'ELLIPSE', 'REGULAR_POLYGON'].includes(node.type)) return
  node.children?.forEach((c) => outline(c, origin, depth + 1, lines))
}

function collectTokens(roots) {
  const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1)
  const colors = new Map()
  const texts = new Map()
  const radii = new Map()
  const spacing = new Map()
  for (const root of roots) {
    walk(root, (n) => {
      for (const p of [...(n.fills ?? []), ...(n.strokes ?? [])]) {
        if (p.type === 'SOLID' && p.visible !== false) count(colors, hex(p.color, p.opacity))
      }
      if (n.type === 'TEXT' && n.style) {
        const s = n.style
        count(texts, `${s.fontFamily} ${s.fontWeight} ${s.fontSize}px / lh${Math.round((s.lineHeightPx ?? 0) * 10) / 10} / ls${Math.round((s.letterSpacing ?? 0) * 100) / 100}`)
      }
      if (n.cornerRadius) count(radii, n.cornerRadius)
      if (n.layoutMode && n.layoutMode !== 'NONE') {
        for (const v of [n.itemSpacing, n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft]) if (v) count(spacing, v)
      }
    })
  }
  const sorted = (map) => Object.fromEntries([...map].sort((a, b) => b[1] - a[1]))
  return { colors: sorted(colors), texts: sorted(texts), radii: sorted(radii), spacing: sorted(spacing) }
}
