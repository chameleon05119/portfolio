// 写真の原本（src/assets/images/source/）を使う形に切り出し、WebP の幅違いを作る
//   npm run photos
// 原本を差し替えたら（例: 生成した写真が届いたら）もう一度実行するだけでよい。拡張子は jpg / png / webp どれでも可
// 切り出す位置は sharp の attention（目立つ部分＝顔など）に任せる。区切りたいときは crop（原本に対する割合）を書く
import { existsSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

const SRC = 'src/assets/images/source'
const OUT = 'src/assets/images'

const PHOTOS = [
  // 原本は Gemini で作った写真（mv・point は 1200×896、visit・voice は 1024×1024、bp は 1376×768）。原本より大きくはしない
  { name: 'mv', size: [1200, 900], widths: [640, 960, 1200] },
  { name: 'visit', size: [800, 800], widths: [320, 640] },
  { name: 'point-1', size: [1200, 900], widths: [480, 960] },
  { name: 'point-2', size: [1200, 900], widths: [480, 960] },
  { name: 'point-3', size: [1200, 900], widths: [480, 960] },
  { name: 'point-4', size: [1200, 900], widths: [480, 960] },
  { name: 'bp', size: [1024, 768], widths: [480, 960] },
  // 先輩の声は丸く小さく出すので、上半身の写真から顔のまわりを切り出す（crop は原本に対する割合: 左, 上, 幅, 高さ）
  { name: 'voice-1', size: [360, 360], widths: [240, 360], crop: [0.355, 0.1, 0.35, 0.35] },
  { name: 'voice-2', size: [360, 360], widths: [240, 360], crop: [0.335, 0.08, 0.35, 0.35] },
  { name: 'voice-3', size: [360, 360], widths: [240, 360], crop: [0.325, 0.09, 0.35, 0.35] },
]

const find = (name) => ['jpg', 'jpeg', 'png', 'webp'].map((ext) => `${SRC}/${name}.${ext}`).find(existsSync)

async function load({ name, crop }) {
  const file = find(name)
  if (!file) throw new Error(`原本がありません: ${SRC}/${name}.(jpg|png|webp)`)
  const img = sharp(file).rotate()
  if (!crop) return img
  const { width, height } = await img.metadata()
  const [x, y, w, h] = crop
  return sharp(file).rotate().extract({ left: Math.round(width * x), top: Math.round(height * y), width: Math.round(width * w), height: Math.round(height * h) })
}

for (const p of PHOTOS) {
  const [w, h] = p.size
  const buf = await (await load(p)).resize({ width: w, height: h, fit: 'cover', position: sharp.strategy.attention }).toBuffer()
  for (const width of p.widths) await sharp(buf).resize({ width }).webp({ quality: 78 }).toFile(`${OUT}/${p.name}-${width}w.webp`)
  console.log(`${p.name}: ${p.widths.map((x) => `${x}w`).join(' ')}`)
}

// SNS でシェアされたときの画像（1200×630）
mkdirSync('src/public', { recursive: true })
await (await load({ name: 'mv' })).resize({ width: 1200, height: 630, fit: 'cover', position: sharp.strategy.attention }).jpeg({ quality: 80 }).toFile('src/public/ogp.jpg')
console.log('ogp.jpg')
