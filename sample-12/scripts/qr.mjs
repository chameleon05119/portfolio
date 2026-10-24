// チラシ・資料に載せる QR コード（申し込みページ＝この作品の紹介ページ）を SVG で作る
//   node scripts/qr.mjs
import { writeFileSync } from 'node:fs'
import QRCode from 'qrcode'

const URL = 'https://chameleon05119.github.io/portfolio/sample-12/'
const svg = await QRCode.toString(URL, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1b4a80', light: '#ffffff' } })
writeFileSync('src/assets/images/qr.svg', svg)
console.log('src/assets/images/qr.svg ←', URL)
