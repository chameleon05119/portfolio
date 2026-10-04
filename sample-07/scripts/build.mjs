// テーマの CSS をビルドし、公開用のファイルを dist/ に作る
//
//   theme/hitotoki/assets/css/style.css         ← src/scss/style.scss（圧縮しない。納品先で手直しできるように）
//   theme/hitotoki/assets/css/editor-style.css  ← src/scss/editor-style.scss（投稿の編集画面用）
//   dist/hitotoki.zip    テーマ（管理画面の「テーマのアップロード」でそのまま入れられる形）
//   dist/seed.zip        デモの初期データ（seed/seed.php と写真）
//   dist/blueprint.json  WordPress Playground の起動手順（テーマを入れて初期データを流す）
//   dist/index.html      作品集から開く入口（Playground で開くボタン）
//
//   node scripts/build.mjs           公開用（URL は https://chameleon05119.github.io/portfolio/sample-07/）
//   node scripts/build.mjs --css     CSS だけ（開発中）
//   BASE_URL=http://… node scripts/build.mjs   別の場所に置くとき
import { createWriteStream } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ZipArchive } from 'archiver'
import * as sass from 'sass'
import { blueprint } from './blueprint.mjs'

const root = resolve(import.meta.dirname, '..')
const theme = resolve(root, 'theme/hitotoki')
const dist = resolve(root, 'dist')
const BASE_URL = process.env.BASE_URL ?? 'https://chameleon05119.github.io/portfolio/sample-07/'

async function buildCss() {
  await mkdir(resolve(theme, 'assets/css'), { recursive: true })
  for (const name of ['style', 'editor-style']) {
    const { css } = sass.compile(resolve(root, `src/scss/${name}.scss`), { style: 'expanded' })
    await writeFile(resolve(theme, `assets/css/${name}.css`), `${css}\n`)
  }
  console.log('built theme/hitotoki/assets/css/')
}

// dir の中身を zip に入れる（prefix はアーカイブ内のフォルダ名）
function zip(dir, out, prefix) {
  return new Promise((done, fail) => {
    const archive = new ZipArchive({ zlib: { level: 9 } })
    const stream = createWriteStream(out)
    stream.on('close', done)
    archive.on('error', fail)
    archive.pipe(stream)
    archive.glob('**/*', { cwd: dir, ignore: ['**/.DS_Store'], dot: false }, { prefix })
    archive.finalize()
  })
}

await buildCss()

if (!process.argv.includes('--css')) {
  await rm(dist, { recursive: true, force: true })
  await mkdir(dist, { recursive: true })
  await zip(theme, resolve(dist, 'hitotoki.zip'), 'hitotoki')
  await zip(resolve(root, 'seed'), resolve(dist, 'seed.zip'), '')
  await writeFile(resolve(dist, 'blueprint.json'), `${JSON.stringify(blueprint({ baseUrl: BASE_URL }), null, 2)}\n`)
  const landing = await readFile(resolve(root, 'src/landing/index.html'), 'utf8')
  await writeFile(resolve(dist, 'index.html'), landing.replaceAll('{{BLUEPRINT_URL}}', encodeURIComponent(`${BASE_URL}blueprint.json`)))
  await copyFile(resolve(theme, 'assets/images/favicon.svg'), resolve(dist, 'favicon.svg'))
  console.log(`built dist/ (BASE_URL=${BASE_URL})`)
}
