// 取得した写真（src/assets/images/*.jpg）を使う形に切り出し、WebP の幅違いを作る（sample-08 用・1回だけ実行）
//   mv: PC は 2:1（二人の頭の上に吹き出しの余白）、スマホは 4:5
//   縦長の写真: 4:3 に切り出す（位置は sharp の attention＝目立つ部分を残す）
import sharp from 'sharp'

const DIR = 'src/assets/images'
const out = (name, w) => `${DIR}/${name}-${w}w.webp`

async function make(name, pipeline, widths) {
  const buf = await pipeline.toBuffer()
  for (const w of widths) await sharp(buf).resize({ width: w }).webp({ quality: 78 }).toFile(out(name, w))
}

// メインビジュアル（元 2400x3600）
await make('mv-pc', sharp(`${DIR}/mv.jpg`).extract({ left: 0, top: 900, width: 2400, height: 1200 }), [1200, 1800, 2400])
await make('mv-sp', sharp(`${DIR}/mv.jpg`).extract({ left: 0, top: 0, width: 2400, height: 3000 }), [600, 900])

const portrait = ['feat-web', 'rehab-exercise', 'rehab-manual', 'room-1', 'room-2', 'clinic-xray']
const landscape = ['feat-rehab', 'feat-dxa', 'feat-access', 'rehab-physical', 'room-3', 'clinic-exam']
for (const name of portrait) await make(name, sharp(`${DIR}/${name}.jpg`).resize({ width: 1200, height: 900, fit: 'cover', position: sharp.strategy.attention }), [480, 960])
for (const name of landscape) await make(name, sharp(`${DIR}/${name}.jpg`).resize({ width: 1200, height: 900, fit: 'cover' }), [480, 960])
await make('rehab-main', sharp(`${DIR}/rehab-main.jpg`).resize({ width: 1600, height: 1200, fit: 'cover' }), [640, 1200, 1600])
await make('clinic-reception', sharp(`${DIR}/clinic-reception.jpg`).resize({ width: 1600, height: 1200, fit: 'cover' }), [640, 1200])
console.log('done')
