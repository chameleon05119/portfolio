<?php
/**
 * テーマの機能・画像サイズ・ナビの場所
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'after_setup_theme',
	function () {
		add_theme_support( 'title-tag' );
		add_theme_support( 'post-thumbnails' );
		add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script', 'navigation-widgets' ) );
		add_theme_support( 'responsive-embeds' );

		// 投稿の編集画面を、公開ページと同じ文字・色で表示する
		add_theme_support( 'editor-styles' );
		add_editor_style( 'assets/css/editor-style.css' );

		// ブロックエディターの色・文字サイズの選択肢を、サイトのトークンに絞る（好きな色を選べないようにして見た目を崩さない）
		add_theme_support( 'disable-custom-colors' );
		add_theme_support( 'disable-custom-font-sizes' );
		add_theme_support( 'disable-custom-gradients' );
		add_theme_support(
			'editor-color-palette',
			array(
				array( 'name' => '焦げ茶', 'slug' => 'ink', 'color' => '#2f2622' ),
				array( 'name' => 'ブラウン', 'slug' => 'accent', 'color' => '#7a4a30' ),
				array( 'name' => '生成り', 'slug' => 'bg', 'color' => '#f3eee6' ),
				array( 'name' => 'ラテ', 'slug' => 'bg-sub', 'color' => '#e7ddcf' ),
			)
		);
		add_theme_support( 'editor-gradient-presets', array() );

		// 記事の写真（一覧・記事上部）。3:2 に切り抜く
		set_post_thumbnail_size( 900, 600, true );
		add_image_size( 'hitotoki-card', 500, 333, true );

		// 管理画面の「外観 > メニュー」で並びを変えられる場所。未設定のときは inc/template-tags.php の初期値を使う
		register_nav_menus(
			array(
				'global' => 'ヘッダー・スマホメニュー',
				'footer' => 'フッター',
			)
		);
	}
);

// タイトルの区切りを「｜」にする（例: メニュー｜ひととき珈琲）
add_filter( 'document_title_separator', fn() => '｜' );

// トップは「店名｜キャッチフレーズ」の順にする（WordPress の初期値は逆）
add_filter(
	'document_title_parts',
	function ( $parts ) {
		if ( is_front_page() && ! empty( $parts['tagline'] ) ) {
			$parts = array(
				'title'   => get_bloginfo( 'name' ),
				'tagline' => $parts['tagline'],
			);
		}
		return $parts;
	}
);

// WordPress は区切りの前後に空白を入れるので詰める（ひととき珈琲 ｜ … → ひととき珈琲｜…）
add_filter( 'document_title', fn( $title ) => str_replace( ' ｜ ', '｜', $title ) );

// 使っていない絵文字の読み込みを外す（表示を軽くする）
remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
remove_action( 'wp_print_styles', 'print_emoji_styles' );
remove_action( 'admin_print_scripts', 'print_emoji_detection_script' );
remove_action( 'admin_print_styles', 'print_emoji_styles' );

// 一覧の抜粋は 60 文字ほどで切る（日本語は単語で区切れないため文字数で数える）
add_filter( 'excerpt_length', fn() => 60 );
add_filter( 'excerpt_more', fn() => '…' );
