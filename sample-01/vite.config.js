import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = resolve(import.meta.dirname, 'src')

// src 直下の *.html をすべてページとして書き出す（下層ページは about.html のように置く）
const pages = Object.fromEntries(
  readdirSync(root)
    .filter((f) => f.endsWith('.html'))
    .map((f) => [f.replace(/\.html$/, ''), resolve(root, f)]),
)

// file:// で開いても CSS が読めるよう、Vite が付ける crossorigin を外す
const stripCrossorigin = {
  name: 'strip-crossorigin',
  transformIndexHtml: (html) => html.replace(/ crossorigin/g, ''),
}

export default defineConfig({
  plugins: [stripCrossorigin],
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
          if (name.endsWith('.css')) return 'assets/css/style[extname]'
          if (/\.(woff2?|ttf|otf)$/.test(name)) return 'assets/fonts/[name][extname]'
          return 'assets/images/[name][extname]'
        },
      },
    },
  },
})
