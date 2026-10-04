// PHP の構文チェック（php -l）。PHP を入れていなくても、Playground と同じ PHP（WebAssembly）で動かす
//   node scripts/lint-php.mjs [PHP の版。初期値 8.0 = テーマの Requires PHP]
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { loadNodeRuntime } from '@php-wasm/node'
import { PHP } from '@php-wasm/universal'

const root = resolve(import.meta.dirname, '..')
const version = process.argv[2] ?? '8.0'
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith('.php') ? [join(dir, d.name)] : []))

// token_get_all の TOKEN_PARSE は、構文エラーがあると ParseError を投げる（php -l と同じ判定）
const php = new PHP(await loadNodeRuntime(version, { emscriptenOptions: { processId: 1 } }))
let failed = 0
for (const file of [...files(resolve(root, 'theme')), ...files(resolve(root, 'seed'))]) {
  php.writeFile('/tmp/check.php', readFileSync(file))
  const res = await php.run({
    code: `<?php try { token_get_all(file_get_contents('/tmp/check.php'), TOKEN_PARSE); echo 'OK'; } catch (ParseError $e) { echo $e->getMessage() . ' (line ' . $e->getLine() . ')'; }`,
  })
  if (res.text !== 'OK') {
    failed++
    console.log(`${relative(root, file)}: ${res.text}`)
  }
}
console.log(failed ? `✗ ${failed} 件` : `✓ PHP ${version} で構文エラーなし`)
process.exit(failed ? 1 : 0)
