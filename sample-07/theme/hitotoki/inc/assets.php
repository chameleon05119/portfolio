<?php
/**
 * CSS・JS・フォントの読み込み
 */

defined( 'ABSPATH' ) || exit;

const HITOTOKI_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Shippori+Mincho+B1:wght@500;700&display=swap';

add_action(
	'wp_enqueue_scripts',
	function () {
		wp_enqueue_style( 'hitotoki-fonts', HITOTOKI_FONTS_URL, array(), null ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- Google Fonts は URL で版が決まる
		wp_enqueue_style( 'hitotoki', HITOTOKI_URI . '/assets/css/style.css', array(), HITOTOKI_VERSION );

		wp_enqueue_script(
			'hitotoki',
			HITOTOKI_URI . '/assets/js/main.js',
			array(),
			HITOTOKI_VERSION,
			array(
				'in_footer' => false,
				'strategy'  => 'defer',
			)
		);
		// 営業時間・定休日・臨時休業を「お店の情報」から JS に渡す
		wp_add_inline_script( 'hitotoki', 'window.hitotokiShop = ' . wp_json_encode( hitotoki_shop_script_config() ) . ';', 'before' );
	}
);

// ブロックのうち使わないもの（クラシックテーマ用の互換 CSS・グローバルスタイル）は外して軽くする
// 色パレットのクラス（.has-accent-color など）は src/scss/project/_wp.scss で持つ
add_action(
	'wp_enqueue_scripts',
	function () {
		wp_dequeue_style( 'classic-theme-styles' );
		wp_dequeue_style( 'global-styles' );
	},
	20
);

// フォントは描画を止めないように後から読み込む（読み込むまでは OS のフォントで表示）
add_filter(
	'style_loader_tag',
	function ( $tag, $handle, $href ) {
		if ( 'hitotoki-fonts' !== $handle ) {
			return $tag;
		}
		$url = esc_url( $href );
		return "<link rel=\"stylesheet\" id=\"hitotoki-fonts-css\" href=\"{$url}\" media=\"print\" onload=\"this.media='all'\" />\n<noscript><link rel=\"stylesheet\" href=\"{$url}\" /></noscript>\n";
	},
	10,
	3
);

// JS が読み込めなかったとき（ブロック・アップロード漏れなど）は、アニメーション用に隠した本文を出す
// WordPress が出力する <script ... src=...> の形に依存しているので、WordPress の更新後は効いているか確認する（効かなくても head の 3 秒の保険で本文は出る）
add_filter(
	'script_loader_tag',
	fn( $tag, $handle ) => 'hitotoki' === $handle ? str_replace( ' src=', ' onerror="document.documentElement.classList.remove(\'js\')" src=', $tag ) : $tag,
	10,
	2
);

add_action(
	'wp_head',
	function () {
		?>
<script>
  // JS が動く環境の目印。アニメーションで要素を隠すときは .js 配下に限定する（描画前に付けてちらつきを防ぐ）
  // main.js が動かなかったときに本文が隠れたままにならないよう、3秒で外す
  document.documentElement.classList.add('js')
  setTimeout(function () {
    if (!window.siteReady) document.documentElement.classList.remove('js')
  }, 3000)
</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
		<?php
		// 最初の画面の写真を先読みする（トップのみ）
		if ( is_front_page() ) {
			$img = HITOTOKI_URI . '/assets/images/';
			printf(
				'<link rel="preload" as="image" href="%1$smv-750w.webp" imagesrcset="%1$smv-750w.webp 750w, %1$smv-1200w.webp 1200w, %1$smv-1800w.webp 1800w" imagesizes="(min-width: 1024px) 65vw, 100vw" fetchpriority="high" />' . "\n",
				esc_url( $img )
			);
		}
	},
	1
);

// サイトアイコンが未設定のときは、テーマのロゴマークを使う
add_action(
	'wp_head',
	function () {
		if ( ! has_site_icon() ) {
			printf( '<link rel="icon" href="%s" />' . "\n", esc_url( HITOTOKI_URI . '/assets/images/favicon.svg' ) );
		}
		echo '<meta name="theme-color" content="#f3eee6" />' . "\n";
	}
);
