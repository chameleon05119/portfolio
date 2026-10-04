<?php
/**
 * アクセスの地図。架空の店のため簡易図（実際のお店では Google マップの埋め込みに差し替える）
 */

defined( 'ABSPATH' ) || exit;
?>
<figure class="p-map u-reveal">
  <svg viewBox="0 0 1080 400" role="img" aria-label="地図：〇〇駅の南口を出て、商店街を南へ進み、2つ目の角を左に曲がった先、公園の向かいにひととき珈琲があります">
    <rect width="1080" height="400" fill="#efe7db" />
    <path d="M0 300 C200 280 300 330 520 320 S900 260 1080 290" fill="none" stroke="#c9dbe0" stroke-width="26" />
    <g stroke="#fbf8f3" stroke-width="18" fill="none">
      <path d="M0 110H1080" />
      <path d="M300 0V400" />
      <path d="M300 230H1080" />
      <path d="M620 110V400" />
      <path d="M860 0V230" />
    </g>
    <rect x="120" y="66" width="360" height="40" rx="4" fill="#d9cdbd" />
    <text x="300" y="92" text-anchor="middle" font-size="16" fill="#4a352b">〇〇駅</text>
    <text x="300" y="138" text-anchor="middle" font-size="13" fill="#6b5d55">南口</text>
    <rect x="680" y="140" width="150" height="70" rx="6" fill="#d6dfc8" />
    <text x="755" y="181" text-anchor="middle" font-size="14" fill="#3f4d34">ひだまり公園</text>
    <text x="318" y="190" font-size="13" fill="#6b5d55">商店街</text>
    <path d="M300 118V230H596" fill="none" stroke="#8c5a3c" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round" />
    <circle cx="620" cy="262" r="30" fill="#4a352b" opacity=".12" />
    <path d="M620 274c-14-16-22-26-22-36a22 22 0 0 1 44 0c0 10-8 20-22 36z" fill="#4a352b" />
    <circle cx="620" cy="238" r="8" fill="#fbf8f3" />
    <text x="652" y="282" font-size="17" font-weight="700" fill="#2f2622">ひととき珈琲</text>
  </svg>
  <figcaption>〇〇駅 南口から商店街を南へ。2つ目の角を左に曲がり、ひだまり公園の向かいです（架空の店のため簡易図です）。</figcaption>
</figure>
