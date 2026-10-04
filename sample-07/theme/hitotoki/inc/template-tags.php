<?php
/**
 * テンプレートで使う表示用の関数
 */

defined( 'ABSPATH' ) || exit;

// ===== ナビ =====

/**
 * ナビの項目。「外観 > メニュー」で設定されていればそれを、なければ初期の並びを返す
 * 項目の「説明」に英字（例: Menu）を入れると、スマホメニューの右側に小さく出る
 *
 * @return array<int, array{url: string, label: string, en: string}>
 */
function hitotoki_nav_items( $location ) {
	$locations = get_nav_menu_locations();
	if ( ! empty( $locations[ $location ] ) ) {
		$items = wp_get_nav_menu_items( $locations[ $location ] );
		if ( $items ) {
			return array_map(
				fn( $item ) => array(
					'url'   => $item->url,
					'label' => $item->title,
					'en'    => $item->description,
				),
				array_filter( $items, fn( $item ) => ! $item->menu_item_parent )
			);
		}
	}

	$home  = home_url( '/' );
	$items = array(
		array( 'url' => $home . '#about', 'label' => 'お店のこと', 'en' => 'About' ),
		array( 'url' => $home . '#scenes', 'label' => '過ごし方', 'en' => 'How to spend' ),
		array( 'url' => (string) get_post_type_archive_link( HITOTOKI_MENU ), 'label' => 'メニュー', 'en' => 'Menu' ),
		array( 'url' => hitotoki_news_url(), 'label' => 'お知らせ', 'en' => 'News' ),
		array( 'url' => $home . '#access', 'label' => 'アクセス', 'en' => 'Access' ),
	);
	// フッターは「過ごし方」を省いた短い並び
	return 'footer' === $location ? array_values( array_filter( $items, fn( $i ) => ! str_ends_with( $i['url'], '#scenes' ) ) ) : $items;
}

/** お知らせ一覧の URL（設定 > 表示設定 の「投稿ページ」） */
function hitotoki_news_url() {
	$page = (int) get_option( 'page_for_posts' );
	return $page ? get_permalink( $page ) : home_url( '/' );
}

/** 今いるページに当たるナビ項目なら aria-current を付ける（ページ内リンク #… は対象外） */
function hitotoki_nav_current( $url ) {
	if ( str_contains( $url, '#' ) ) {
		return '';
	}
	$current = array();
	if ( is_front_page() ) {
		$current[] = home_url( '/' );
	} elseif ( is_post_type_archive( HITOTOKI_MENU ) ) {
		$current[] = get_post_type_archive_link( HITOTOKI_MENU );
	} elseif ( is_home() || is_category() || is_singular( 'post' ) ) {
		$current[] = hitotoki_news_url();
	} elseif ( is_singular() ) {
		$current[] = get_permalink();
	}
	$norm = fn( $u ) => untrailingslashit( (string) $u );
	return in_array( $norm( $url ), array_map( $norm, $current ), true ) ? ' aria-current="page"' : '';
}

// ===== アイコン・ロゴ =====

function hitotoki_logo() {
	?>
	<a class="l-logo" href="<?php echo esc_url( home_url( '/' ) ); ?>">
		<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M11 21h15v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7z" fill="currentColor" /><path d="M26 22.5h1.5a2.5 2.5 0 0 1 0 5H25" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M15.5 17c-1.2-1.6 1.2-2.4 0-4.5M19.5 17c-1.2-1.6 1.2-2.4 0-4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
		<span class="l-logo__name"><?php bloginfo( 'name' ); ?><small>Hitotoki Coffee</small></span>
	</a>
	<?php
}

function hitotoki_ig_icon() {
	return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r=".8" fill="currentColor" /></svg>';
}

/** 新しいタブで開くリンクの読み上げ用の補足 */
function hitotoki_new_tab_note() {
	return '<span class="u-visually-hidden">（新しいタブで開く）</span>';
}

// ===== 画像 =====

/**
 * テーマ内の写真（assets/images/名前-幅w.webp）を srcset 付きで出す
 *
 * @param string $name   ファイル名の頭（例: about-room）
 * @param int[]  $widths 用意している幅（例: [600, 1200]）。src には最後の幅を使う
 * @param array  $attrs  width・height・alt・sizes・loading など
 */
function hitotoki_img( $name, $widths, $attrs ) {
	$base   = HITOTOKI_URI . '/assets/images/' . $name;
	$srcset = implode( ', ', array_map( fn( $w ) => esc_url( "{$base}-{$w}w.webp" ) . " {$w}w", $widths ) );
	$attrs  = array_merge(
		array(
			'src'      => "{$base}-" . end( $widths ) . 'w.webp',
			'srcset'   => count( $widths ) > 1 ? $srcset : null,
			'loading'  => 'lazy',
			'decoding' => 'async',
		),
		$attrs
	);
	$html = '<img';
	foreach ( $attrs as $key => $value ) {
		if ( null === $value || false === $value ) {
			continue;
		}
		$html .= sprintf( ' %s="%s"', $key, 'src' === $key ? esc_url( $value ) : esc_attr( $value ) );
	}
	return $html . ' />';
}

// ===== パンくず =====

/**
 * @param array<int, array{0: string, 1?: string}> $trail [ 表示名, URL ] の並び。最後が今のページ
 */
function hitotoki_breadcrumb( $trail ) {
	array_unshift( $trail, array( 'トップ', home_url( '/' ) ) );
	$last = count( $trail ) - 1;
	echo '<nav class="l-breadcrumb" aria-label="パンくずリスト"><div class="l-container"><ol>';
	foreach ( $trail as $i => $crumb ) {
		if ( $i === $last ) {
			printf( '<li aria-current="page">%s</li>', esc_html( $crumb[0] ) );
		} else {
			printf( '<li><a href="%s">%s</a></li>', esc_url( $crumb[1] ), esc_html( $crumb[0] ) );
		}
	}
	echo '</ol></div></nav>';
}

/** 下層ページの見出し（英字＋日本語） */
function hitotoki_page_head( $title, $en, $lead = '' ) {
	?>
	<div class="l-page-head"><div class="l-container">
		<span class="l-page-head__en" aria-hidden="true"><?php echo esc_html( $en ); ?></span>
		<h1><?php echo esc_html( $title ); ?></h1>
		<?php if ( $lead ) : ?>
			<p><?php echo esc_html( $lead ); ?></p>
		<?php endif; ?>
	</div></div>
	<?php
}

// ===== お知らせ =====

/** 投稿のカテゴリ（最初の 1 つ）。「未分類」は出さない */
function hitotoki_post_category( $post = null ) {
	$cats = get_the_category( $post ? $post->ID : 0 );
	foreach ( $cats as $cat ) {
		if ( (int) get_option( 'default_category' ) !== $cat->term_id ) {
			return $cat;
		}
	}
	return null;
}

/** お知らせ一覧の 1 行 */
function hitotoki_news_item( $post = null ) {
	$post = get_post( $post );
	$cat  = hitotoki_post_category( $post );
	printf(
		'<li><a href="%s"><time datetime="%s">%s</time>%s<span class="c-news-list__title">%s</span></a></li>',
		esc_url( get_permalink( $post ) ),
		esc_attr( get_the_date( 'Y-m-d', $post ) ),
		esc_html( get_the_date( 'Y.m.d', $post ) ),
		$cat ? '<span class="c-category">' . esc_html( $cat->name ) . '</span>' : '',
		esc_html( get_the_title( $post ) )
	);
}
