// 組み立てた _site/ を、本番（https://chameleon05119.github.io/portfolio/）と同じ /portfolio/ 配下で配信する
//   npm run preview → http://localhost:4321/portfolio/
// ハブ（Astro）は base: '/portfolio' で書き出しているので、ルート直下で配信すると CSS・JS・画像が 404 になる
import { mkdir, rm, symlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve('.preview');
await rm(root, { recursive: true, force: true });
await mkdir(root);
await symlink(resolve('_site'), resolve(root, 'portfolio'), 'dir');
console.log('http://localhost:4321/portfolio/');
// URL を書き換えない（.html なしの URL も開ける）サーバーを使う
spawn('npx', ['--yes', 'http-server', root, '-p', '4321', '-c-1', '-s'], { stdio: 'inherit' });
