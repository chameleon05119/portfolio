import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { defineConfig } from 'vite'

const root = resolve(import.meta.dirname, 'src')
const partialsDir = resolve(root, '_partials')

// src 以下の *.html をすべてページとして書き出す（about.html、news/2026-01-01.html のように置く）
// _partials（共通部品）・public・assets の中は対象外
const skip = new Set(['_partials', 'public', 'assets'])
const findPages = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = resolve(dir, d.name)
    if (d.isDirectory()) return skip.has(d.name) ? [] : findPages(p)
    return d.name.endsWith('.html') ? [p] : []
  })
const pages = Object.fromEntries(findPages(root).map((p) => [relative(root, p).replace(/\.html$/, ''), p]))

// 共通部品の読み込み。ビルド結果は部品を展開した普通の HTML になる
//   <!-- include: header.html -->  … src/_partials/header.html の中身に置き換える
//   部品の中の {{root}}            … ページの階層に合わせた相対パス（'./' や '../'）に置き換える
//   <body data-page="about">       … 部品の中の data-nav="about" のリンクに aria-current="page" を付ける
const includePartials = {
  name: 'include-partials',
  transformIndexHtml: {
    order: 'pre', // Vite が画像などのパスを処理する前に展開する
    handler(html, { filename }) {
      const depth = relative(root, filename).split(sep).length - 1
      const rootPath = depth ? '../'.repeat(depth) : './'
      const page = html.match(/<body[^>]*\sdata-page="([^"]+)"/)?.[1]
      let out = html.replace(/<!--\s*include:\s*([\w./-]+)\s*-->/g, (_, file) =>
        readFileSync(resolve(partialsDir, file), 'utf8').trim(),
      )
      out = out.replaceAll('{{root}}', rootPath)
      if (page) out = out.replaceAll(`data-nav="${page}"`, `data-nav="${page}" aria-current="page"`)
      return out
    },
  },
  // 部品を編集したら開発サーバーのページを読み込み直す
  handleHotUpdate({ file, server }) {
    if (file.startsWith(partialsDir)) server.ws.send({ type: 'full-reload' })
  },
}

// file:// で開いても CSS が読めるよう、Vite が付ける crossorigin を外す
const stripCrossorigin = {
  name: 'strip-crossorigin',
  // Google Fonts の preconnect など、自分で書いた crossorigin は残す（外すと接続が再利用されない）
  transformIndexHtml: (html) =>
    html.replace(/<(?:script|link)\b[^>]*>/g, (tag) => (/(?:src|href)="[^"]*assets\//.test(tag) ? tag.replace(' crossorigin', '') : tag)),
}

export default defineConfig({
  plugins: [includePartials, stripCrossorigin],
  root,
  publicDir: resolve(root, 'public'),
  base: './', // 納品先のディレクトリ構成に依存しない相対パス
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // クライアントが手で編集できるよう、圧縮せずファイル名も固定する
    minify: false,
    cssMinify: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: pages,
      output: {
        assetFileNames: ({ names }) => {
          const name = names?.[0] ?? ''
          if (name.endsWith('.css')) return 'assets/css/[name][extname]'
          if (/\.(woff2?|ttf|otf)$/.test(name)) return 'assets/fonts/[name][extname]'
          return 'assets/images/[name][extname]'
        },
      },
    },
  },
})
