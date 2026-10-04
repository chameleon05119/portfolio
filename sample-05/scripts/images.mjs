// 画像を WebP に変換し、必要なら幅違いを作る（元画像はそのまま残す）
//
//   npm run images                                   src/assets/images の jpg/png をすべて同じ大きさの WebP に
//   npm run images -- mainvisual.jpg --widths 750,1200,1920   幅違いの WebP（mainvisual-750w.webp ...）を作る
//
// HTML では <picture> + srcset で出し分ける。アイコンなど小さい PNG は変換しても軽くならないことがあるので、
// 出力サイズを見て元のままにするか決める。

import { readdirSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const DIR = 'src/assets/images'
const args = process.argv.slice(2)
const i = args.indexOf('--widths')
const widths = i === -1 ? [] : args[i + 1].split(',').map(Number)
const targets = args.filter((a, j) => !a.startsWith('--') && (i === -1 || j !== i + 1))
const files = targets.length ? targets : readdirSync(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f))

for (const file of files) {
  const src = join(DIR, file)
  const name = basename(file, extname(file))
  const { width } = await sharp(src).metadata()
  const outputs = widths.length ? widths.filter((w) => w <= width).map((w) => [w, `${name}-${w}w.webp`]) : [[width, `${name}.webp`]]
  for (const [w, out] of outputs) {
    await sharp(src).resize({ width: w }).webp({ quality: 80 }).toFile(join(DIR, out))
    const before = statSync(src).size
    const after = statSync(join(DIR, out)).size
    console.log(`${out}  ${kb(after)}（元 ${file} ${kb(before)}）`)
  }
}

function kb(bytes) {
  return `${Math.round(bytes / 1024)}KB`
}
