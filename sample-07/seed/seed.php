<?php
/**
 * デモ用の初期データを入れる（WordPress Playground の起動時に 1 回だけ実行）
 *
 * blueprint の runPHP から、wp-load.php を読み込んだ状態で require される。
 * テーマ（hitotoki）を有効にしたあとに実行するので、メニューの投稿タイプ・分類が使える
 *
 * 入れるもの: 固定ページ（トップ・お知らせ）、お知らせ 5 件、メニューの分類 4 つと品目、ナビ、表示設定
 * パーマリンクは blueprint の setSiteOptions で先に設定しておく（scripts/blueprint.mjs）
 */

defined( 'ABSPATH' ) || exit;

// 2 回目以降は何もしない（固定ページ・分類・ナビが重複しないように）
if ( get_option( 'hitotoki_seeded' ) ) {
	return;
}

require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

/** 写真をメディアライブラリに入れて ID を返す（同じファイルは 1 回だけ） */
function hitotoki_seed_media( $file, $alt ) {
	static $cache = array();
	if ( isset( $cache[ $file ] ) ) {
		return $cache[ $file ];
	}
	// media_handle_sideload は元のファイルを移動するので、コピーを渡す
	$tmp = wp_tempnam( $file );
	copy( __DIR__ . '/media/' . $file, $tmp );
	$id = media_handle_sideload(
		array(
			'name'     => $file,
			'tmp_name' => $tmp,
		),
		0,
		$alt
	);
	if ( is_wp_error( $id ) ) {
		error_log( 'seed media: ' . $id->get_error_message() );
		return 0;
	}
	update_post_meta( $id, '_wp_attachment_image_alt', $alt );
	return $cache[ $file ] = $id;
}

// ===== 最初から入っているサンプルを消す =====
foreach ( get_posts( array( 'post_type' => array( 'post', 'page' ), 'post_status' => 'any', 'numberposts' => -1 ) ) as $p ) {
	if ( in_array( $p->post_name, array( 'hello-world', 'sample-page' ), true ) ) {
		wp_delete_post( $p->ID, true );
	}
}
wp_delete_comment( 1, true );

// ===== 固定ページと表示設定 =====
$front = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'トップ', 'post_name' => 'top' ) );
$news  = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'お知らせ', 'post_name' => 'news' ) );
update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $front );
update_option( 'page_for_posts', $news );
update_option( 'posts_per_page', 10 );

// ===== お知らせ =====
$cats = array();
foreach ( array( 'menu' => 'メニュー', 'open' => '営業', 'shop' => 'お店' ) as $slug => $name ) {
	$term          = wp_insert_term( $name, 'category', array( 'slug' => $slug ) );
	$cats[ $slug ] = is_wp_error( $term ) ? (int) $term->get_error_data() : $term['term_id'];
}

$p  = fn( $text ) => "<!-- wp:paragraph -->\n<p>{$text}</p>\n<!-- /wp:paragraph -->\n\n";
$h2 = fn( $text ) => "<!-- wp:heading -->\n<h2 class=\"wp-block-heading\">{$text}</h2>\n<!-- /wp:heading -->\n\n";
$ul = fn( $items ) => "<!-- wp:list -->\n<ul class=\"wp-block-list\">" . implode( '', array_map( fn( $i ) => "<!-- wp:list-item -->\n<li>{$i}</li>\n<!-- /wp:list-item -->", $items ) ) . "</ul>\n<!-- /wp:list -->\n\n";

$posts = array(
	array(
		'date'    => '2026-08-10 10:00:00',
		'cat'     => 'open',
		'title'   => '夏季休業のお知らせ',
		'excerpt' => '8月13日（木）〜16日（日）は夏季休業です。17日（月）から通常どおり営業します。',
		'image'   => array( 'about-room.jpg', '木の椅子とテーブルが並ぶ店内' ),
		'content' => $p( '誠に勝手ながら、下記の期間を夏季休業とさせていただきます。' ) . $h2( '休業期間' ) . $p( '2026年8月13日（木）〜 8月16日（日）' ) . $p( '8月17日（月）からは、通常どおり 8:00 から営業します。' ),
	),
	array(
		'date'    => '2026-08-25 10:00:00',
		'cat'     => 'menu',
		'title'   => 'アイスコーヒーは9月29日までです',
		'excerpt' => '夏の間お出ししていたアイスコーヒーは、9月29日（火）で今年の提供を終えます。',
		'image'   => array( 'menu-drip.jpg', 'ハンドドリップでコーヒーを淹れる様子' ),
		'content' => $p( '夏の間お出ししていたアイスコーヒーは、9月29日（火）で今年の提供を終えます。たくさんのご注文、ありがとうございました。' ) . $p( '10月からは、カフェオレとカフェインレスのアイスでお楽しみください。' ),
	),
	array(
		'date'    => '2026-09-05 10:00:00',
		'cat'     => 'shop',
		'title'   => '本棚の本を入れ替えました',
		'excerpt' => 'ソファ席の横の本棚を、秋に向けて入れ替えました。30冊ほどが新しく並んでいます。',
		'image'   => array( 'space-books.jpg', '本が並ぶ木の本棚' ),
		'content' => $p( 'ソファ席の横の本棚を、秋に向けて入れ替えました。エッセイ、旅の本、料理の本、絵本など、30冊ほどが新しく並んでいます。' ) . $p( '店内の本は、どなたでも自由に読んでいただけます。読み終わったら、近くの棚に戻していただければ大丈夫です。' ) . $p( '「この本を置いてほしい」というリクエストも、スタッフにお気軽にどうぞ。' ),
	),
	array(
		'date'    => '2026-09-20 10:00:00',
		'cat'     => 'open',
		'title'   => '10月の定休日のお知らせ',
		'excerpt' => '10月の定休日は、毎週水曜日と第3木曜日（15日）です。',
		'image'   => array( 'space-window.jpg', '大きな窓に面したテーブル席' ),
		'content' => $p( '10月の定休日をお知らせします。' ) . $h2( 'お休みの日' ) . $ul( array( '毎週水曜日（10月7日・14日・21日・28日）', '第3木曜日（10月15日）' ) ) . $p( '営業時間はいつもどおり 8:00〜18:00（ラストオーダー 17:30）です。今月の営業日は、トップページのカレンダーでも確認できます。' ),
	),
	array(
		'date'    => '2026-10-01 10:00:00',
		'cat'     => 'menu',
		'title'   => '10月の焼き菓子は、かぼちゃのスコーンです',
		'excerpt' => '10月の季節のスコーンは、かぼちゃです。ほくほくの甘さと、シナモンの香り。13時ごろに焼き上がります。',
		'image'   => array( 'news.jpg', 'テーブルの上のコーヒーと焼き菓子' ),
		'content' => $p( '10月の季節のスコーンは、かぼちゃです。蒸したかぼちゃを生地にたっぷり練り込み、シナモンをほんの少し。ほくほくとした甘さが、深煎りブレンドとよく合います。' ) . $h2( '焼き上がりの時間' ) . $p( '毎日 13:00 ごろに焼き上がります。数に限りがあるため、なくなり次第終了です。' ) . $p( 'お持ち帰りもできます。6個以上のご注文は、前日までにお電話でご予約ください。' ),
	),
);

foreach ( $posts as $post ) {
	$id = wp_insert_post(
		array(
			'post_status'   => 'publish',
			'post_title'    => $post['title'],
			'post_content'  => $post['content'],
			'post_excerpt'  => $post['excerpt'],
			'post_date'     => $post['date'],
			'post_category' => array( $cats[ $post['cat'] ] ),
		)
	);
	set_post_thumbnail( $id, hitotoki_seed_media( ...$post['image'] ) );
}

// ===== メニュー =====
// [ スラッグ, 名前, 英字, 補足, 写真, 写真の説明, 品目[ 品名, 価格, 価格の書き方, ひとこと, マーク, トップに表示 ] ]
$menu = array(
	array(
		'coffee', 'コーヒー', 'Coffee', 'コーヒーはすべてテイクアウトできます（同じ価格です）。', 'menu-drip.jpg', 'ハンドドリップでコーヒーを淹れる様子',
		array(
			array( '本日のハンドドリップ', 550, '', 'その日のおすすめの豆を、一杯ずつ', array(), true ),
			array( 'ひとときブレンド', 550, '', 'すっきりとして、毎日飲める味', array(), false ),
			array( '深煎りブレンド', 580, '', '焼き菓子に合う、しっかりした苦み', array(), false ),
			array( 'カフェオレ', 600, '', '温かい ／ 冷たい', array( 'ice' ), true ),
			array( 'カフェインレス', 600, '', '夕方や、妊娠中の方にも', array( 'ice' ), false ),
		),
	),
	array(
		'drinks', 'そのほかの飲み物', 'Other drinks', '', 'menu-latte.jpg', 'ラテアートを描いたカップ',
		array(
			array( '紅茶（ダージリン）', 550, '', '', array( 'ice' ), false ),
			array( 'ほうじ茶ラテ', 600, '', '', array( 'ice' ), false ),
			array( 'ココア', 580, '', '', array(), false ),
			array( 'りんごジュース', 500, '', '長野県産のストレート果汁', array(), false ),
			array( 'こども用ミルク', 300, '', '小学生までのお子さま', array(), false ),
		),
	),
	array(
		'sweets', '焼き菓子', 'Sweets', '焼き菓子は毎日 13:00 ごろに焼き上がります。なくなり次第終了です。', 'menu-sweets.jpg', 'カプチーノと焼き菓子',
		array(
			array( 'プレーンスコーン', 380, '', 'クロテッドクリームとジャムを添えて', array( 'takeout' ), false ),
			array( '季節のスコーン', 420, '', '10月は、かぼちゃ', array( 'takeout' ), true ),
			array( 'ガトーショコラ', 480, '', '', array(), false ),
			array( 'バナナブレッド', 400, '', '', array( 'takeout' ), false ),
			array( '焼き菓子セット', 300, 'plus', 'お好きな飲み物と一緒に（飲み物の価格に）', array(), false ),
		),
	),
	array(
		'food', 'モーニング・軽食', 'Morning & Food', '', 'menu-food.jpg', 'トーストとカフェオレ',
		array(
			array( 'トーストのモーニング', 250, 'plus', '8:00〜10:30。厚切りトースト・ゆで卵・小さなサラダ（飲み物の価格に）', array(), false ),
			array( 'あんバタートースト', 520, '', '', array(), false ),
			array( 'ハムとチーズのホットサンド', 780, '', '', array(), false ),
			array( 'たまごサンド', 720, '', '', array(), false ),
		),
	),
);

$order = 0;
foreach ( $menu as $i => [ $slug, $name, $en, $note, $image, $alt, $items ] ) {
	$term    = wp_insert_term( $name, HITOTOKI_MENU_CAT, array( 'slug' => $slug ) );
	$term_id = $term['term_id'];
	$img_id  = hitotoki_seed_media( $image, $alt );
	update_term_meta( $term_id, 'hitotoki_en', $en );
	update_term_meta( $term_id, 'hitotoki_note', $note );
	update_term_meta( $term_id, 'hitotoki_order', ( $i + 1 ) * 10 );
	update_term_meta( $term_id, 'hitotoki_image', $img_id );

	foreach ( $items as [ $title, $price, $type, $desc, $marks, $featured ] ) {
		$order += 10;
		$id     = wp_insert_post(
			array(
				'post_type'   => HITOTOKI_MENU,
				'post_status' => 'publish',
				'post_title'  => $title,
				'menu_order'  => $order,
			)
		);
		wp_set_object_terms( $id, $term_id, HITOTOKI_MENU_CAT );
		update_post_meta( $id, '_hitotoki_price', $price );
		update_post_meta( $id, '_hitotoki_price_type', $type );
		update_post_meta( $id, '_hitotoki_desc', $desc );
		update_post_meta( $id, '_hitotoki_marks', $marks );
		update_post_meta( $id, '_hitotoki_featured', $featured ? 1 : 0 );
		if ( $featured ) {
			set_post_thumbnail( $id, $img_id );
		}
	}
}

// ===== ナビ（外観 > メニュー）=====
$home = home_url( '/' );
$navs = array(
	'global' => array(
		'ヘッダー',
		array(
			array( 'お店のこと', $home . '#about', 'About' ),
			array( '過ごし方', $home . '#scenes', 'How to spend' ),
			array( 'メニュー', get_post_type_archive_link( HITOTOKI_MENU ), 'Menu' ),
			array( 'お知らせ', get_permalink( $news ), 'News' ),
			array( 'アクセス', $home . '#access', 'Access' ),
		),
	),
	'footer' => array(
		'フッター',
		array(
			array( 'お店のこと', $home . '#about', '' ),
			array( 'メニュー', get_post_type_archive_link( HITOTOKI_MENU ), '' ),
			array( 'お知らせ', get_permalink( $news ), '' ),
			array( 'アクセス', $home . '#access', '' ),
		),
	),
);
$locations = array();
foreach ( $navs as $location => [ $menu_name, $links ] ) {
	$menu_id = wp_create_nav_menu( $menu_name );
	foreach ( $links as [ $label, $url, $en ] ) {
		wp_update_nav_menu_item(
			$menu_id,
			0,
			array(
				'menu-item-title'       => $label,
				'menu-item-url'         => $url,
				'menu-item-description' => $en,
				'menu-item-status'      => 'publish',
				'menu-item-type'        => 'custom',
			)
		);
	}
	$locations[ $location ] = $menu_id;
}
set_theme_mod( 'nav_menu_locations', $locations );

flush_rewrite_rules();

update_option( 'hitotoki_seeded', 1 );
