<?php
/**
 * ひととき珈琲 テーマの読み込み口。機能ごとに inc/ に分けている
 *
 * inc/setup.php          テーマの機能・画像サイズ・ナビの場所
 * inc/assets.php         CSS・JS・フォントの読み込み
 * inc/shop-settings.php  管理画面「お店の情報」（営業時間・定休日・臨時休業・住所など）
 * inc/menu-items.php     管理画面「メニュー」（品目・分類・価格）
 * inc/template-tags.php  テンプレートで使う表示用の関数
 * inc/seo.php            meta description・OGP
 */

defined( 'ABSPATH' ) || exit;

define( 'HITOTOKI_VERSION', wp_get_theme()->get( 'Version' ) );
define( 'HITOTOKI_DIR', get_template_directory() );
define( 'HITOTOKI_URI', get_template_directory_uri() );

require HITOTOKI_DIR . '/inc/setup.php';
require HITOTOKI_DIR . '/inc/assets.php';
require HITOTOKI_DIR . '/inc/shop-settings.php';
require HITOTOKI_DIR . '/inc/menu-items.php';
require HITOTOKI_DIR . '/inc/template-tags.php';
require HITOTOKI_DIR . '/inc/seo.php';
