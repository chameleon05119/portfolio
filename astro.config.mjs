// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages（https://chameleon05119.github.io/portfolio/）に置く
export default defineConfig({
  site: 'https://chameleon05119.github.io',
  base: '/portfolio',
  trailingSlash: 'always',
  outDir: './dist-hub',
});
