// 開発用: WordPress Playground（Docker も PHP も不要）でテーマを動かし、SCSS の変更を監視する
//   http://127.0.0.1:9400/ でサイト、/wp-admin/ で管理画面（admin / password でログイン済み。LOGIN=0 で未ログイン）
//   PORT=9402 で別のポート
//   テーマのフォルダをそのままマウントするので、PHP・JS を保存すれば再読み込みで反映される
//   データは起動のたびに初期データ（seed/seed.php）から作り直す（保存しない）
import { execSync, spawn } from 'node:child_process'
import { existsSync, watch } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { blueprint } from './blueprint.mjs'

const root = resolve(import.meta.dirname, '..')
const port = process.env.PORT ?? '9400'
const tmp = resolve(root, '.playground')
await mkdir(tmp, { recursive: true })

// WordPress 本体は日本語版を 1 回だけダウンロードして使い回す（起動のたびに wordpress.org へ取りに行かない）
// 起動のたびに展開し直して、データを初期状態に戻す
const zip = resolve(tmp, 'wordpress.zip')
if (!existsSync(zip)) {
  console.log('WordPress（日本語版）をダウンロードします…')
  execSync(`curl -fL -C - --retry 5 -o "${zip}" https://ja.wordpress.org/latest-ja.zip`, { stdio: 'inherit' })
}
// ポートごとに別のフォルダにする（2 つ同時に起動しても互いのデータを消さない）
const site = resolve(tmp, `site-${port}`)
const wp = resolve(site, 'wordpress')
await rm(site, { recursive: true, force: true })
execSync(`unzip -q "${zip}" -d "${site}"`)

const bp = resolve(site, 'blueprint.json')
await writeFile(bp, JSON.stringify(blueprint({ local: true, login: process.env.LOGIN !== '0' }), null, 2))

// 回線が遅いと、Node の接続（IPv4/IPv6 を 250ms ずつ試す）が時間切れになり、wordpress.org からの取得が fetch failed になる。待ち時間を延ばす
const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --network-family-autoselection-attempt-timeout=3000`.trim() }
const run = (args) => spawn('node', args, { cwd: root, stdio: 'inherit', env })

// CSS を一度ビルドしてから、SCSS の保存のたびにビルドし直す
await new Promise((done) => run(['scripts/build.mjs', '--css']).on('exit', done))
let timer = 0
watch(resolve(root, 'src/scss'), { recursive: true }, () => {
  clearTimeout(timer)
  timer = setTimeout(() => run(['scripts/build.mjs', '--css']), 150)
})

run([
  'node_modules/@wp-playground/cli/wp-playground.js',
  'server',
  `--port=${port}`,
  '--mount-before-install',
  `${wp}:/wordpress`,
  '--wordpress-install-mode=install-from-existing-files',
  '--mount-before-install', // テーマを入れた状態で WordPress を起動する（activateTheme で見つかるように）
  `${resolve(root, 'theme/hitotoki')}:/wordpress/wp-content/themes/hitotoki`,
  '--mount',
  `${resolve(root, 'seed')}:/seed`,
  `--blueprint=${bp}`,
])
