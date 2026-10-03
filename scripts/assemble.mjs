// 公開用のサイト（_site/）を組み立てる。GitHub Actions とローカル確認で同じものを使う
//   _site/            ← Astro のハブ（dist-hub/）
//   _site/sample-01/  ← sample-01 を Vite でビルドしたもの
//   _site/sample-02/  ← sample-02 をそのまま
//   _site/sample-03/  ← sample-03 を Vite でビルドしたもの
import { cp, rm } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

await rm('_site', { recursive: true, force: true });
await cp('dist-hub', '_site', { recursive: true });

run('npm ci --no-audit --no-fund', 'sample-01');
run('npm run build', 'sample-01');
await cp('sample-01/dist', '_site/sample-01', { recursive: true });

await cp('sample-02', '_site/sample-02', { recursive: true });

run('npm ci --no-audit --no-fund', 'sample-03');
run('npm run build', 'sample-03');
await cp('sample-03/dist', '_site/sample-03', { recursive: true });
console.log('assembled _site/');
