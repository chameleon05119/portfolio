<?php
/**
 * meta description・OGP
 * SEO プラグイン（Yoast SEO など）を入れたときは二重にならないよう出力しない
 */

defined( 'ABSPATH' ) || exit;

/** SEO プラグイン（Yoast SEO・Rank Math・All in One SEO）が入っているか */
function hitotoki_has_seo_plugin() {
	return defined( 'WPSEO_VERSION' ) || defined( 'RANK_MATH_VERSION' ) || defined( 'AIOSEO_VERSION' );
}

/** ページごとの説明文 */
function hitotoki_meta_description() {
	if ( is_front_page() ) {
		return sprintf(
			'一杯ずつハンドドリップで淹れるコーヒーと、自家製の焼き菓子。住宅街の小さな喫茶店で、少しひと息つきませんか。%s、%s（%s定休）。',
			hitotoki_shop( 'access' ),
			str_replace( ' – ', '〜', hitotoki_hours_label() ),
			hitotoki_closed_label()
		);
	}
	if ( is_post_type_archive( HITOTOKI_MENU ) ) {
		return get_bloginfo( 'name' ) . 'のメニュー。一杯ずつ淹れるハンドドリップコーヒー、カフェオレ、自家製の焼き菓子、トーストのモーニングなど。';
	}
	if ( is_home() ) {
		return get_bloginfo( 'name' ) . 'からのお知らせ。季節のメニュー、定休日・営業時間の変更、お店のことなど。';
	}
	if ( is_category() ) {
		return get_bloginfo( 'name' ) . 'からのお知らせ（' . single_cat_title( '', false ) . '）。';
	}
	if ( is_singular() ) {
		return wp_strip_all_tags( get_the_excerpt() );
	}
	return get_bloginfo( 'description' );
}

add_action(
	'wp_head',
	function () {
		if ( hitotoki_has_seo_plugin() ) {
			return;
		}
		// 404・検索結果は共有されるページではないので、説明文・OGP は出さない
		if ( is_404() || is_search() ) {
			return;
		}
		$description = mb_strimwidth( hitotoki_meta_description(), 0, 240, '…' );
		if ( is_paged() ) {
			$description = sprintf( '（%dページ目）', get_query_var( 'paged' ) ) . $description;
		}
		$title       = wp_get_document_title();
		$image       = is_singular() && has_post_thumbnail() ? get_the_post_thumbnail_url( null, 'large' ) : HITOTOKI_URI . '/assets/images/og.jpg';
		$url         = match ( true ) {
			is_front_page()                       => home_url( '/' ),
			is_singular()                         => get_permalink(),
			is_post_type_archive( HITOTOKI_MENU ) => get_post_type_archive_link( HITOTOKI_MENU ),
			default                               => get_pagenum_link( max( 1, (int) get_query_var( 'paged' ) ) ), // お知らせ一覧・カテゴリ別（ページ送りも含む）
		};

		printf( '<meta name="description" content="%s" />' . "\n", esc_attr( $description ) );
		printf( '<meta property="og:type" content="%s" />' . "\n", is_singular( 'post' ) ? 'article' : 'website' );
		printf( '<meta property="og:site_name" content="%s" />' . "\n", esc_attr( get_bloginfo( 'name' ) ) );
		printf( '<meta property="og:title" content="%s" />' . "\n", esc_attr( $title ) );
		printf( '<meta property="og:description" content="%s" />' . "\n", esc_attr( $description ) );
		printf( '<meta property="og:url" content="%s" />' . "\n", esc_url( $url ) );
		printf( '<meta property="og:image" content="%s" />' . "\n", esc_url( $image ) );
		echo '<meta name="twitter:card" content="summary_large_image" />' . "\n";
	},
	5
);

// お店の情報を検索エンジンに伝える構造化データ（トップのみ）。値は「お店の情報」から作る
// https://developers.google.com/search/docs/appearance/structured-data/local-business
// 営業日は「毎週のお休み」だけを反映する（第◯曜日・臨時休業は表しきれないため）
add_action(
	'wp_head',
	function () {
		if ( ! is_front_page() || hitotoki_has_seo_plugin() ) {
			return;
		}
		$days  = array( 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' );
		$open  = array_values( array_diff( range( 0, 6 ), array_map( 'intval', (array) hitotoki_shop( 'closed_days' ) ) ) );
		$data  = array(
			'@context'                  => 'https://schema.org',
			'@type'                     => 'CafeOrCoffeeShop',
			'name'                      => get_bloginfo( 'name' ),
			'url'                       => home_url( '/' ),
			'image'                     => HITOTOKI_URI . '/assets/images/og.jpg',
			'telephone'                 => hitotoki_shop( 'tel' ),
			'address'                   => array(
				'@type'         => 'PostalAddress',
				'postalCode'    => hitotoki_shop( 'postal' ),
				'streetAddress' => hitotoki_shop( 'address' ),
				'addressCountry' => 'JP',
			),
			'openingHoursSpecification' => array(
				'@type'     => 'OpeningHoursSpecification',
				'dayOfWeek' => array_map( fn( $d ) => $days[ $d ], $open ),
				'opens'     => hitotoki_shop( 'open' ),
				'closes'    => hitotoki_shop( 'close' ),
			),
			'servesCuisine'             => 'コーヒー・焼き菓子',
			'menu'                      => get_post_type_archive_link( HITOTOKI_MENU ),
			'sameAs'                    => array_filter( array( hitotoki_shop( 'instagram' ) ) ),
		);
		// / は \/ のまま出す（値に </script> が入っても閉じないように）
		echo '<script type="application/ld+json">' . wp_json_encode( $data, JSON_UNESCAPED_UNICODE ) . "</script>\n";
	}
);
