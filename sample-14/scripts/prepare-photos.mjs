// 写真の原本（src/assets/images/source/）を使う形に切り出し、WebP の幅違いを作る
//   npm run photos
// 原本を差し替えたらもう一度実行するだけでよい。出典は src/assets/images/SOURCES.md
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const SRC = 'src/assets/images/source'
const OUT = 'src/assets/images'

const PHOTOS = [
  { name: 'mv', size: [1000, 1000], widths: [480, 760, 1000] },
  { name: 'side', size: [480, 480], widths: [240, 480] },
  { name: 'point-1', size: [960, 720], widths: [480, 960] },
  { name: 'point-2', size: [960, 720], widths: [480, 960] },
  { name: 'point-3', size: [960, 720], widths: [480, 960] },
  { name: 'menu-1', size: [800, 800], widths: [360, 800] },
  { name: 'menu-2', size: [800, 800], widths: [360, 800] },
  { name: 'menu-3', size: [800, 800], widths: [360, 800] },
  { name: 'menu-4', size: [800, 800], widths: [360, 800] },
  { name: 'article', size: [1200, 675], widths: [640, 1200] },
]

for (const p of PHOTOS) {
  const [w, h] = p.size
  const buf = await sharp(`${SRC}/${p.name}.jpg`).rotate().resize({ width: w, height: h, fit: 'cover', position: sharp.strategy.attention }).toBuffer()
  for (const width of p.widths) await sharp(buf).resize({ width }).webp({ quality: 78 }).toFile(`${OUT}/${p.name}-${width}w.webp`)
  console.log(`${p.name}: ${p.widths.map((x) => `${x}w`).join(' ')}`)
}

// SNS でシェアされたときの画像（1200×630）。商品LP・記事LP で別にする
mkdirSync('src/public', { recursive: true })
await sharp(`${SRC}/mv.jpg`).resize({ width: 1200, height: 630, fit: 'cover' }).jpeg({ quality: 80 }).toFile('src/public/ogp.jpg')
await sharp(`${SRC}/article.jpg`).resize({ width: 1200, height: 630, fit: 'cover' }).jpeg({ quality: 80 }).toFile('src/public/ogp-article.jpg')
console.log('ogp.jpg / ogp-article.jpg')
