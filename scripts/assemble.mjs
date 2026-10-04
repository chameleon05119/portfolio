// 公開用のサイト（_site/）を組み立てる。GitHub Actions とローカル確認で同じものを使う
//   _site/            ← Astro のハブ（dist-hub/）
//   _site/sample-01/  ← sample-01 を Vite でビルドしたもの
//   _site/sample-02/  ← sample-02 をそのまま
//   _site/sample-03/  ← sample-03 を Vite でビルドしたもの
//   _site/sample-04/  ← sample-04 を Vite でビルドしたもの
//   _site/sample-05/  ← sample-05 を Vite でビルドしたもの
//   _site/sample-06/  ← sample-06 を Vite でビルドしたもの
//   _site/sample-07/  ← sample-07（WordPress テーマ）の入口ページ・テーマの zip・初期データ・Playground の起動手順
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

run('npm ci --no-audit --no-fund', 'sample-04');
run('npm run build', 'sample-04');
await cp('sample-04/dist', '_site/sample-04', { recursive: true });

run('npm ci --no-audit --no-fund', 'sample-05');
run('npm run build', 'sample-05');
await cp('sample-05/dist', '_site/sample-05', { recursive: true });

run('npm ci --no-audit --no-fund', 'sample-06');
run('npm run build', 'sample-06');
await cp('sample-06/dist', '_site/sample-06', { recursive: true });
run('npm ci --no-audit --no-fund', 'sample-07');
run('npm run build', 'sample-07');
await cp('sample-07/dist', '_site/sample-07', { recursive: true });
console.log('assembled _site/');
